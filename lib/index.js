// DSH (DeepSeek Harness) plugin: serve LLM calls through the OAuth tokens
// your local CLIs already hold, instead of a separately configured API key.
//
//   - openai-codex  -> reads ~/.codex/auth.json (ChatGPT/Codex OAuth), refreshes
//                      the access token automatically, and streams against
//                      https://chatgpt.com/backend-api via the pi-ai engine.
//   - anthropic     -> reads Claude Code OAuth from ~/.claude/.credentials.json
//                      (legacy) or macOS Keychain service Claude Code-credentials
//                      (current), then streams against https://api.anthropic.com.
//
// Both providers appear in the model picker once this plugin is loaded.
import { LlmError } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { defaultCodexAuthPath, resolveCodexAccessToken } from "./token-store.js";
import { defaultClaudeAuthPath, resolveClaudeAccessToken } from "./claude-keychain.js";
import { withUsageProbe } from "./usage.js";

/** Plugin identity used by the cordis loader entry. */
export const name = "llm-local-token";
/** Register only after the llm service exists. */
export const inject = ["llm"];
/** Route prefix serving the quota snapshots to the browser. */
const USAGE_PREFIX = "/llm-local-token";

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Attach an api-key auth method to a provider that pi-ai ships as OAuth-only
 * (the openai-codex provider). pi-ai's `resolveProviderAuth` honours an
 * `apiKey` override only when `provider.auth.apiKey` exists; without it the
 * request dies with "Provider is not configured". The harness resolves the
 * local token itself and hands it over as the request's apiKey, so this method
 * only needs to pass that key through to the wire.
 */
function withApiKeyAuth(provider, name) {
  return {
    ...provider,
    auth: {
      ...provider.auth,
      apiKey: {
        name,
        resolve: async ({ credential }) => ({
          auth: credential?.key === void 0 ? {} : { apiKey: credential.key },
          source: name,
        }),
      },
    },
  };
}

/** Transport values pi-ai's profile vocabulary accepts. */
const TRANSPORTS = ["sse", "websocket", "websocket-cached", "auto"];

/**
 * Build one adapter profile in the shape PiAiAdapter expects.
 * @param transport - optional streaming transport preference; undefined leaves
 * pi-ai's own default ("auto") in charge.
 */
function profileOf(provider, displayName, piProvider, transport) {
  return {
    provider,
    displayName,
    piProvider,
    retryPolicy: undefined,
    streamIdleTimeoutMs: 300_000,
    configuredMaxTokens: new Map(),
    ...(transport === undefined ? {} : { transport }),
  };
}

/**
 * Plugin entry. Builds the local-token routes, registers one pi-ai adapter
 * serving them, and exposes the providers to the model picker.
 */
export async function apply(ctx, config = {}) {
  const routes = [];
  /** Latest quota snapshot per provider id, replaced on every observed response. */
  const usage = new Map();
  /**
   * Diagnostics for "the badge shows no numbers": which process/apply owns this
   * route, how many responses the probe observed, and when the last one landed.
   * Cheap to keep and the only way to tell a stale host from a broken probe.
   */
  const diag = { pid: process.pid, appliedAt: new Date().toISOString(), observed: 0, lastAt: null, lastProvider: null };
  const record = (snapshot) => {
    usage.set(snapshot.provider, snapshot);
    diag.observed += 1;
    diag.lastAt = snapshot.at;
    diag.lastProvider = snapshot.provider;
  };

  // ── Codex route: local ~/.codex/auth.json (ChatGPT OAuth) ────────────────
  //
  // Transport matters for the quota badge. Under pi-ai's default "auto" the
  // Codex provider streams over WebSocket, and the `x-codex-*` quota headers
  // exist only on the SSE response — so the usage probe observes nothing and the
  // badge stays empty forever. "sse" keeps it as fresh as the Claude route; set
  // `codexTransport: "auto"` to prefer WebSocket and accept no quota data.
  const codexAuthPath = config.codexAuthPath ?? defaultCodexAuthPath();
  const requestedTransport = config.codexTransport ?? "sse";
  const codexTransport = TRANSPORTS.includes(requestedTransport) ? requestedTransport : "sse";
  if (codexTransport !== requestedTransport) {
    ctx.logger.info(`llm-local-token: ignoring unknown codexTransport "${requestedTransport}"; using "sse"`);
  }
  routes.push({
    provider: "openai-codex",
    displayName: "OpenAI Codex (local token)",
    piProvider: withUsageProbe(withApiKeyAuth(openaiCodexProvider(), "Codex local token"), record),
    resolveApiKey: async () => resolveCodexAccessToken(codexAuthPath),
    transport: codexTransport,
  });

  // ── Claude route: local Claude Code credentials (legacy file or Keychain) ─
  const claudeAuthPath = config.claudeAuthPath ?? defaultClaudeAuthPath();
  const claudeKeychainService = config.claudeKeychainService ?? "Claude Code-credentials";
  try {
    // Resolve once at startup to decide whether to register the route. Requests
    // resolve again so token refreshes/Keychain updates are observed.
    await resolveClaudeAccessToken({ filePath: claudeAuthPath, service: claudeKeychainService, account: config.claudeKeychainAccount });
    routes.push({
      provider: "anthropic",
      displayName: "Claude (local token)",
      piProvider: withUsageProbe(anthropicProvider(), record),
      resolveApiKey: async () => resolveClaudeAccessToken({ filePath: claudeAuthPath, service: claudeKeychainService, account: config.claudeKeychainAccount }),
    });
  } catch (error) {
    if (config.requireClaude === true) throw error;
    ctx.logger.info(`llm-local-token: Claude local token not usable (${String(error?.message ?? error).slice(0, 160)}); skipping Claude provider`);
  }

  const profiles = () => new Map(routes.map((route) => [
    route.provider,
    profileOf(route.provider, route.displayName, route.piProvider, route.transport),
  ]));

  const adapter = new PiAiAdapter({
    profiles,
    resolveApiKey: async (provider) => {
      const route = routes.find((entry) => entry.provider === provider);
      if (route === void 0) {
        throw new LlmError(`llm-local-token does not own provider "${provider}"`, "NO_ADAPTER");
      }
      try {
        return await route.resolveApiKey();
      } catch (error) {
        throw new LlmError(error?.message ?? String(error), "MISSING_CREDENTIAL", { cause: error });
      }
    },
    resolveAttachments: () => ctx.get("attachments"),
  });

  ctx.llm.registerAdapter(routes.map((route) => route.provider), adapter);

  // Quota snapshots observed on real responses, newest per provider.
  ctx.inject(["webServer"], (wctx) => {
    wctx.effect(() => wctx.webServer.register({
      kind: "prefix",
      path: USAGE_PREFIX,
      handler: (req, res) => {
        const path = new URL(req.url ?? "/", "http://localhost").pathname.slice(USAGE_PREFIX.length).replace(/^\/+/, "");
        if (req.method !== "GET" || (path !== "usage" && path !== "")) {
          return sendJson(res, 404, { error: `unknown route "${path}"` });
        }
        return sendJson(res, 200, {
          providers: routes.map((route) => ({
            provider: route.provider,
            displayName: route.displayName,
            usage: usage.get(route.provider) ?? null,
          })),
          diag,
          fetchedAt: new Date().toISOString(),
        });
      },
    }), "llm-local-token: usage route");
    wctx.logger.info(`llm-local-token: usage route mounted at ${USAGE_PREFIX}/usage`);
  });
  ctx.logger.info(`llm-local-token: registered ${routes.map((route) => route.provider).join(", ")} (codex auth: ${codexAuthPath}, codex transport: ${codexTransport})`);
}

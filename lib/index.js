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
import { defaultCodexAuthPath, readCodexAuth, resolveCodexAccessToken } from "./token-store.js";
import { defaultClaudeAuthPath, resolveClaudeAccessToken } from "./claude-keychain.js";
import { anthropicUsage, codexUsage, withUsageProbe } from "./usage.js";
import { probeAnthropicQuota, probeCodexQuota } from "./probe.js";
import { GLM_ALIASES, GLM_PROVIDER, glmBaseDomain, glmUsage, probeGlmQuota, resolveGlmToken } from "./glm.js";

/** Plugin identity used by the cordis loader entry. */
export const name = "llm-local-token";
/**
 * Register only after the llm service exists. `timer` joins it because cordis
 * throws on reading ctx.setTimeout/setInterval unless the service is declared
 * here; the base profile mounts cordis-plugin-timer.
 */
export const inject = ["llm", "timer"];
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
 * The route-owned image request policy. pi-ai fills these from its own defaults
 * only for config-declared providers; a `profiles` callback like ours is read
 * verbatim, so an omitted field arrives as undefined and
 * `dsh-attachment-local` rejects the request with "Image request maxPixels must
 * be a positive integer" the moment any history entry carries an image. The
 * values below are pi-ai's own defaults.
 */
const IMAGE_POLICY = {
  maxRequestImageBytes: 20_971_520,
  requestImagePixelBudget: 4_194_304,
  requestImageMaxBytes: 1_048_576,
};

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
    ...IMAGE_POLICY,
    ...(transport === undefined ? {} : { transport }),
  };
}

/**
 * Plugin entry. Builds the local-token routes, registers one pi-ai adapter
 * serving them, and exposes the providers to the model picker.
 */
export async function apply(ctx, config = {}) {
  const routes = [];
  /**
   * Providers this plugin reports quota for but does not serve.
   *
   * Kept apart from `routes` on purpose: `registerAdapter` claims every id it is
   * given, so listing a provider dsh already serves would have this plugin fight
   * pi-ai for it. These entries only ever contribute a snapshot.
   */
  const quotaOnly = [];
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
  /** The Codex endpoint wants the account id beside the token; absent is fine. */
  const codexAccountId = async () => {
    try {
      const auth = await readCodexAuth(codexAuthPath);
      return auth?.tokens?.account_id ?? auth?.account_id;
    } catch {
      return undefined;
    }
  };
  routes.push({
    provider: "openai-codex",
    displayName: "OpenAI Codex (local token)",
    piProvider: withUsageProbe(withApiKeyAuth(openaiCodexProvider(), "Codex local token"), record),
    resolveApiKey: async () => resolveCodexAccessToken(codexAuthPath),
    transport: codexTransport,
    readQuota: codexUsage,
    probe: async () => probeCodexQuota({
      accessToken: await resolveCodexAccessToken(codexAuthPath),
      accountId: await codexAccountId(),
      model: config.usageProbeCodexModel,
    }),
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
      readQuota: anthropicUsage,
      probe: async () => probeAnthropicQuota({
        accessToken: await resolveClaudeAccessToken({ filePath: claudeAuthPath, service: claudeKeychainService, account: config.claudeKeychainAccount }),
        model: config.usageProbeAnthropicModel,
      }),
    });
  } catch (error) {
    if (config.requireClaude === true) throw error;
    ctx.logger.info(`llm-local-token: Claude local token not usable (${String(error?.message ?? error).slice(0, 160)}); skipping Claude provider`);
  }

  // ── GLM quota: dsh already serves this route, so only the numbers are ours ─
  //
  // The credential is resolved once here to decide whether to report at all;
  // each probe resolves again so a rotated key or a fresh zcode sign-in lands
  // without a restart.
  if (config.glmQuota !== false) {
    const glmToken = await resolveGlmToken(config);
    if (glmToken === undefined) {
      ctx.logger.info("llm-local-token: no GLM credential found (set glmApiKey, ZAI_CODING_CN_API_KEY, or sign in with zcode); skipping GLM quota");
    } else {
      quotaOnly.push({
        provider: GLM_PROVIDER,
        aliases: GLM_ALIASES,
        displayName: "GLM Coding Plan",
        readQuota: glmUsage,
        probe: async () => probeGlmQuota({
          token: (await resolveGlmToken(config)) ?? glmToken,
          baseDomain: glmBaseDomain(config),
        }),
      });
    }
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

  /** Everything the panel speaks about: routes we serve, plus quota-only entries. */
  const reported = [...routes, ...quotaOnly];

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
          providers: reported.map((route) => ({
            provider: route.provider,
            ...(route.aliases === undefined ? {} : { aliases: route.aliases }),
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
  // ── Scheduled quota refresh ───────────────────────────────────────────────
  //
  // usage.js only reports what a real request happened to return, so the route
  // you are not using reads "no data yet" indefinitely. These probes close that
  // gap without polling the model: one bare minimal request per provider (see
  // probe.js), on a schedule, carrying no prompt, skills, tools or history.
  //
  // A probe is a convenience and never a dependency: each failure is logged and
  // swallowed, leaving the panel with whatever snapshot it already had.
  const probeOnce = async (reason) => {
    for (const route of reported) {
      if (typeof route.probe !== "function") continue;
      try {
        const snapshot = route.readQuota(await route.probe());
        if (snapshot === undefined) {
          ctx.logger.info(`llm-local-token: ${route.provider} probe carried no quota data`);
          continue;
        }
        record(snapshot);
        ctx.logger.info(`llm-local-token: refreshed ${route.provider} quota (${reason})`);
      } catch (error) {
        ctx.logger.info(`llm-local-token: ${route.provider} quota probe failed (${String(error?.message ?? error).slice(0, 160)})`);
      }
    }
  };

  // cordis's timer service disposes these with the plugin; the globals are only
  // a fallback for a profile that did not load it.
  const stops = [];
  const after = (ms, fn) => {
    if (typeof ctx.setTimeout === "function") return void ctx.setTimeout(fn, ms);
    const handle = globalThis.setTimeout(fn, ms);
    stops.push(() => globalThis.clearTimeout(handle));
  };
  const every = (ms, fn) => {
    if (typeof ctx.setInterval === "function") return void ctx.setInterval(fn, ms);
    const handle = globalThis.setInterval(fn, ms);
    stops.push(() => globalThis.clearInterval(handle));
  };
  ctx.on("dispose", () => {
    for (const stop of stops) stop();
  });

  if (config.usageProbe !== false) {
    const atHour = Number(config.usageProbeAtHour);
    const daily = Number.isInteger(atHour) && atHour >= 0 && atHour <= 23;

    // A wall-clock schedule only fires while dsh happens to be running, and a
    // desktop session is usually closed at 03:00 — so boot is its own trigger.
    after(Number(config.usageProbeStartupDelayMs ?? 20000), () => void probeOnce("startup"));

    if (daily) {
      const next = new Date();
      next.setHours(atHour, 0, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      after(next.getTime() - Date.now(), () => {
        void probeOnce("daily");
        every(86400000, () => void probeOnce("daily"));
      });
      ctx.logger.info(`llm-local-token: quota probe scheduled daily at ${String(atHour).padStart(2, "0")}:00 local`);
    } else {
      const requested = Number(config.usageProbeIntervalHours ?? 4);
      const hours = Number.isFinite(requested) && requested > 0 ? requested : 4;
      every(hours * 3600000, () => void probeOnce("interval"));
      ctx.logger.info(`llm-local-token: quota probe scheduled every ${hours}h`);
    }
  }

  const quotaNote = quotaOnly.length === 0 ? "" : `; quota-only: ${quotaOnly.map((entry) => entry.provider).join(", ")}`;
  ctx.logger.info(`llm-local-token: registered ${routes.map((route) => route.provider).join(", ")}${quotaNote} (codex auth: ${codexAuthPath}, codex transport: ${codexTransport})`);
}

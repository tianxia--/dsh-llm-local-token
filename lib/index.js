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

/** Plugin identity used by the cordis loader entry. */
export const name = "llm-local-token";
/** Register only after the llm service exists. */
export const inject = ["llm"];

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

/** Build one adapter profile in the shape PiAiAdapter expects. */
function profileOf(provider, displayName, piProvider) {
  return {
    provider,
    displayName,
    piProvider,
    retryPolicy: undefined,
    streamIdleTimeoutMs: 300_000,
    configuredMaxTokens: new Map(),
  };
}

/**
 * Plugin entry. Builds the local-token routes, registers one pi-ai adapter
 * serving them, and exposes the providers to the model picker.
 */
export async function apply(ctx, config = {}) {
  const routes = [];

  // ── Codex route: local ~/.codex/auth.json (ChatGPT OAuth) ────────────────
  const codexAuthPath = config.codexAuthPath ?? defaultCodexAuthPath();
  routes.push({
    provider: "openai-codex",
    displayName: "OpenAI Codex (local token)",
    piProvider: withApiKeyAuth(openaiCodexProvider(), "Codex local token"),
    resolveApiKey: async () => resolveCodexAccessToken(codexAuthPath),
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
      piProvider: anthropicProvider(),
      resolveApiKey: async () => resolveClaudeAccessToken({ filePath: claudeAuthPath, service: claudeKeychainService, account: config.claudeKeychainAccount }),
    });
  } catch (error) {
    if (config.requireClaude === true) throw error;
    ctx.logger.info(`llm-local-token: Claude local token not usable (${String(error?.message ?? error).slice(0, 160)}); skipping Claude provider`);
  }

  const profiles = () => new Map(routes.map((route) => [
    route.provider,
    profileOf(route.provider, route.displayName, route.piProvider),
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
  ctx.logger.info(`llm-local-token: registered ${routes.map((route) => route.provider).join(", ")} (codex auth: ${codexAuthPath})`);
}

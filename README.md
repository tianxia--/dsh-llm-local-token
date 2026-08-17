# dsh-llm-local-token

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that serves LLM
calls with the OAuth tokens your **local CLIs already hold** — no separate API key, no extra
login. If you are signed in to the Codex CLI or to Claude Code, those subscriptions become
usable model routes inside DSH.

| Provider route | Credential source | Endpoint |
| --- | --- | --- |
| `openai-codex` | `~/.codex/auth.json` (ChatGPT OAuth, shared with the `codex` CLI) | `https://chatgpt.com/backend-api` |
| `anthropic` | `~/.claude/.credentials.json`, else the macOS Keychain item `Claude Code-credentials` | `https://api.anthropic.com` |

Both routes appear in the model picker as soon as the plugin loads. A route whose credential is
missing is skipped instead of failing the boot.

## Why it exists

DSH resolves a provider's key through its credential seam, which expects an API key. Personal
Codex / Claude subscriptions are OAuth-only, so the keys simply do not exist. This plugin
resolves the token per request from the file the CLI maintains, refreshes it when it is close to
expiry, and hands it to the pi-ai engine that DSH already ships.

## Install

```bash
# from git (no npm publish needed)
dsh plugin --profile web add https://github.com/tianxia--/dsh-llm-local-token.git

# or, once published to npm
dsh plugin --profile web add dsh-llm-local-token
```

Enable it by appending a loader entry to the profile's patch layer
(`~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- insert:
    - id: llm-local-token
      name: dsh-llm-local-token
```

Then restart `dsh`. To make it the default model:

```yaml
# ~/.dsh/settings.yaml
agent-default-model:
  provider: openai-codex
  model: gpt-5.6-terra
  reasoningEffort: medium
```

## Configuration

All keys are optional; the defaults match a stock CLI install.

| Key | Default | Meaning |
| --- | --- | --- |
| `codexAuthPath` | `$CODEX_HOME/auth.json`, else `~/.codex/auth.json` | Codex credential file |
| `claudeAuthPath` | `~/.claude/.credentials.json` | Legacy Claude Code credential file |
| `claudeKeychainService` | `Claude Code-credentials` | macOS Keychain service holding the Claude OAuth payload |
| `requireClaude` | `false` | Fail activation when no Claude credential is found, instead of skipping the route |

## Requirements

- Node.js **22.13+** (DSH's own floor; `--use-system-ca` needs it too)
- `dsh-base` in the profile — it already provides `@deepseek-ai/dsh-llm-pi-ai` and `@earendil-works/pi-ai`
- A signed-in CLI: `codex login` for the Codex route; Claude Code for the Anthropic route
- The Claude Keychain lookup is macOS-only. On Linux/Windows only the file store is consulted.

## Token handling

- Read per request, never cached in memory beyond the call
- Refreshed when less than 5 minutes of life remain, then **written back to the same file** the
  CLI reads, so the CLI stays logged in (single-flight: concurrent requests trigger one refresh)
- Written atomically with `0600` permissions
- Never logged, never sent anywhere except the provider endpoint

## Troubleshooting

### `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`

Your traffic goes through a TLS-inspecting proxy (Zscaler, Netskope, corporate MITM). Node does
not trust its root CA even when the OS does. Start DSH with either:

```bash
node --use-system-ca …                          # trust the OS store (Node 22.13+)
NODE_EXTRA_CA_CERTS=/path/to/root-ca.pem dsh …  # or point at the proxy's root cert
```

### `Provider is not configured: openai-codex`

Means the pi-ai provider refused an API-key override. This plugin already attaches an api-key
auth method to the OAuth-only Codex provider; seeing this error again implies a pi-ai version
whose `resolveProviderAuth` changed — open an issue with your `@earendil-works/pi-ai` version.

### The model list shows no Codex/Claude entries

Check the boot log for `llm-local-token: registered …`. If it names only `openai-codex`, no
Claude credential was found (expected when Claude Code was never used on this machine).

## Caveats

- Uses your **personal subscription quota** (ChatGPT Plus/Pro, Claude Pro/Max). Respect the
  provider's terms; this is not a way to share one seat across a team.
- `chatgpt.com/backend-api` is the Codex client's own endpoint, not a documented public API. It
  can change without notice; pin the pi-ai version if you need stability.

## License

MIT

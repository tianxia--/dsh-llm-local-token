// Bare quota probes.
//
// A snapshot only changes when a real request reports it (see usage.js), so a
// route you never call shows nothing at all. These probes close that gap with
// the smallest request each provider accepts: no system prompt, no skills, no
// MCP tools, no conversation history, and nothing stored server-side. The reply
// is discarded — the rate-limit headers are the only thing read back.
//
// Measured cost per probe: Codex 16 input tokens, Anthropic 8 input + 1 output.

import { normalizeHeaders } from "./usage.js";

const CODEX_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses";
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";

/** Models are only a vehicle for the headers; both are overridable in config. */
const CODEX_MODEL = "gpt-5.6-terra";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

/**
 * Take the headers and drop the body: the answer is never used, and cancelling
 * early stops the stream instead of paying for tokens nobody reads.
 */
async function headersOnly(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Already settled or uncancellable; the headers are in hand either way.
  }
  return normalizeHeaders(response.headers);
}

/**
 * Ask ChatGPT's Codex endpoint for one period, purely to read `x-codex-*` back.
 *
 * Three constraints are load-bearing and were each found by being rejected:
 * the endpoint answers only over SSE (the quota headers do not exist on the
 * WebSocket transport), it rejects `max_output_tokens` outright with HTTP 400,
 * and `store: false` is what keeps the probe out of the account's history.
 * @returns normalized response headers.
 */
export async function probeCodexQuota({ accessToken, accountId, model = CODEX_MODEL }) {
  const response = await fetch(CODEX_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "text/event-stream",
      "openai-beta": "responses=experimental",
      originator: "codex_cli_rs",
      ...(accountId === undefined || accountId === null ? {} : { "chatgpt-account-id": String(accountId) }),
    },
    body: JSON.stringify({
      model,
      instructions: "Reply with a single period.",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "." }] }],
      stream: true,
      store: false,
    }),
  });
  return headersOnly(response);
}

/**
 * Ask Anthropic for one token, purely to read `anthropic-ratelimit-unified-*`.
 *
 * The free `/v1/messages/count_tokens` endpoint cannot serve this: it answers
 * HTTP 200 and carries no rate-limit headers at all, so a real (if minimal)
 * message is the only way to learn the numbers.
 * @returns normalized response headers.
 */
export async function probeAnthropicQuota({ accessToken, model = ANTHROPIC_MODEL }) {
  const response = await fetch(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "oauth-2025-04-20",
    },
    body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "." }] }),
  });
  return headersOnly(response);
}

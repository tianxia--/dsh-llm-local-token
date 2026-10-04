// Apply-smoke: run the real plugin entry against the installed dsh-llm /
// dsh-llm-pi-ai and a stub ctx, so an adapter-API mismatch (missing `auth`,
// bad retryPolicy) fails here instead of at the first request in the host.
import { apply, inject } from "../lib/index.js";

const registered = [];
const noop = () => {};
const ctx = {
  logger: { info: noop, warn: noop, error: noop },
  llm: { registerAdapter: (providers, adapter) => registered.push({ providers, adapter }) },
  inject: noop,
  get: () => undefined,
  setTimeout: noop,
  setInterval: noop,
  effect: noop,
  on: noop,
};

await apply(ctx, { glmQuota: false, usageProbeInterval: 0 });
if (registered.length !== 1) throw new Error("adapter not registered");
const { providers, adapter } = registered[0];
if (!providers.includes("openai-codex")) throw new Error("codex route missing");
const info = adapter.providerInfo("openai-codex");
const policy = adapter.providerRetryPolicy("openai-codex");
if (!policy || !policy.mode) throw new Error("retryPolicy not resolved: " + JSON.stringify(policy));
console.log("PASS: apply() registered", providers.join(","), "| retry mode:", policy.mode, "| inject:", inject.join(","));
process.exit(0);

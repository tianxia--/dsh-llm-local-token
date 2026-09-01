// GLM Coding Plan quota.
//
// This one is quota-only, and deliberately so: dsh already serves GLM through
// pi-ai's built-in `zai-coding-cn` route, so registering another would put a
// duplicate GLM in the model picker. What is missing without this file is the
// other half — the badge can only speak about a provider it holds a snapshot
// for, so selecting GLM used to blank it out.
//
// The numbers come from the subscription's own monitor endpoint, the same one
// @z_ai/coding-helper's usage-query skill calls. Verified against both fronts
// (api.z.ai and open.bigmodel.cn) with the same account: identical bodies down
// to the reset epochs, so one parser serves either.

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** The pi-ai route id dsh calls GLM through. */
export const GLM_PROVIDER = "zai-coding-cn";
/**
 * Other ids the same subscription answers for. modlens re-exposes every pi-ai
 * route under a `modlens-` prefix as a separate picker entry, so the session can
 * report either id for what is one account and one quota.
 */
export const GLM_ALIASES = ["modlens-zai-coding-cn"];

/** Mainland front; `api.z.ai` serves the same account and the same body. */
const DEFAULT_BASE = "https://open.bigmodel.cn";
const QUOTA_PATH = "/api/monitor/usage/quota/limit";

/**
 * Minutes per `unit` code.
 *
 * Only the hour is in here, and that is the point: `unit: 3, number: 5` was
 * observed resetting in 4.96h, which pins it, and @z_ai/coding-helper labels the
 * same row "5 Hour". The other codes seen (5 and 6) have self-consistent
 * readings but no proof, and a window mislabelled "1 week" is worse than one
 * left unnamed — an unnamed window still shows its percentage and its reset
 * time, which is what a reader acts on. Add a code here once one is confirmed.
 */
const UNIT_MINUTES = { 3: 60 };

function readJson(path) {
  return readFile(path, "utf8").then(JSON.parse);
}

/**
 * The token for the quota query, in the order that keeps the number honest.
 *
 * The badge must report the subscription the calls are actually billed to, so
 * the key dsh itself calls with wins; the local zcode CLI's OAuth is the
 * fallback for someone who signed in there instead of pasting a key.
 * @returns the token, or undefined when this machine has no GLM credential.
 */
export async function resolveGlmToken(config = {}) {
  if (typeof config.glmApiKey === "string" && config.glmApiKey.length > 0) return config.glmApiKey;

  const fromEnv = process.env[config.glmApiKeyEnv ?? "ZAI_CODING_CN_API_KEY"];
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;

  // dsh's own credential store, where `apiKeyEnv: ZAI_CODING_CN_API_KEY`
  // resolves from. Read the one named ref rather than parsing the document: the
  // file also holds unrelated secrets and has no business being loaded whole.
  try {
    const store = await readFile(config.dshCredentialsPath ?? join(homedir(), ".dsh", ".credentials.yaml"), "utf8");
    const ref = new RegExp(`^\\s*${config.glmApiKeyEnv ?? "ZAI_CODING_CN_API_KEY"}:\\s*(.+)$`, "m").exec(store);
    const value = ref?.[1]?.trim().replace(/^["']|["']$/g, "");
    if (value !== undefined && value.length > 0) return value;
  } catch {
    // Absent or unreadable; the CLI fallbacks below may still answer.
  }

  try {
    const zcode = await readJson(config.zcodeCredentialsPath ?? join(homedir(), ".zcode", "v2", "credentials.json"));
    const oauth = zcode?.["oauth:bigmodel:access_token"];
    if (typeof oauth === "string" && oauth.length > 0) return oauth;
  } catch {
    // zcode not installed or never signed in.
  }

  return undefined;
}

/** Base domain for the monitor endpoint; the account decides which front. */
export function glmBaseDomain(config = {}) {
  const base = config.glmBaseDomain ?? DEFAULT_BASE;
  return String(base).replace(/\/+$/, "");
}

/**
 * Fetch the quota document.
 * @returns the parsed body, for `glmUsage` to read.
 */
export async function probeGlmQuota({ token, baseDomain = DEFAULT_BASE }) {
  const response = await fetch(`${baseDomain}${QUOTA_PATH}`, {
    // The token goes in bare — this endpoint does not take a `Bearer` prefix.
    headers: { authorization: token, "content-type": "application/json" },
  });
  if (!response.ok) throw new Error(`GLM quota HTTP ${response.status}`);
  return response.json();
}

/**
 * Name a row by what it meters, since only some window lengths are knowable.
 *
 * Repeats are fine and expected — two token windows of different lengths both
 * answer "tokens". The one whose length is known renders from `windowMinutes`
 * instead, and the panel keys rows by position rather than by this string.
 */
function kindOf(limit) {
  return limit?.type === "TIME_LIMIT" ? "mcp" : "tokens";
}

/**
 * Read the quota document into the shape the panel renders.
 * @param body - the parsed `/api/monitor/usage/quota/limit` response.
 * @returns the snapshot, or undefined when the body carried no usable limit.
 */
export function glmUsage(body) {
  const limits = body?.data?.limits;
  if (!Array.isArray(limits)) return undefined;

  const windows = [];
  for (const limit of limits) {
    // `percentage` is 0..100 and counts what is USED, not what is left: the
    // metered row reports currentValue 33 of usage 1000 alongside percentage 3.
    const percent = Number(limit?.percentage);
    if (!Number.isFinite(percent)) continue;

    const unitMinutes = UNIT_MINUTES[limit?.unit];
    const count = Number(limit?.number);
    const minutes = unitMinutes === undefined || !Number.isFinite(count) ? undefined : unitMinutes * count;

    // `nextResetTime` is epoch MILLISECONDS here, unlike the seconds the Codex
    // and Anthropic headers carry — so it is not scaled on the way in.
    const reset = Number(limit?.nextResetTime);

    windows.push({
      label: kindOf(limit),
      used: Math.max(0, Math.min(percent / 100, 1)),
      ...(minutes === undefined ? {} : { windowMinutes: minutes }),
      ...(Number.isFinite(reset) && reset > 0 ? { resetAt: new Date(reset).toISOString() } : {}),
    });
  }
  if (windows.length === 0) return undefined;

  // Token windows first. The badge headlines the first two, and the endpoint
  // happens to lead with the MCP row — which would put a tool-call count in
  // front of the number that actually moves when you send a message.
  windows.sort((a, b) => Number(a.label === "mcp") - Number(b.label === "mcp"));

  const level = body?.data?.level;
  return {
    provider: GLM_PROVIDER,
    ...(typeof level === "string" && level.length > 0 ? { plan: level } : {}),
    windows,
    at: new Date().toISOString(),
  };
}

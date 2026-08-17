// Codex / ChatGPT OAuth token store backed by the Codex CLI's local
// credential file (~/.codex/auth.json). The same file the `codex` CLI
// maintains, so a token refreshed here stays valid for the CLI and vice versa.
import { readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/** The public Codex OAuth client id (matches the pi-ai engine and the CLI). */
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
/** Refresh when the access token has less than this much life left. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;
/** In-flight refresh promise, shared by concurrent callers. */
let refreshing = null;

/** Resolve the Codex credential file path honouring $CODEX_HOME. */
export function defaultCodexAuthPath() {
  return process.env.CODEX_HOME
    ? join(process.env.CODEX_HOME, "auth.json")
    : join(homedir(), ".codex", "auth.json");
}

/** Decode a JWT's `exp` claim in milliseconds, or undefined. */
function jwtExpMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function isFresh(token) {
  const exp = jwtExpMs(token);
  return exp === undefined || exp - Date.now() > REFRESH_SKEW_MS;
}

/**
 * Read the current Codex auth document.
 * @param path - credential file path.
 * @returns the parsed JSON document.
 */
export async function readCodexAuth(path = defaultCodexAuthPath()) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

/**
 * Atomically persist a refreshed auth document, preserving the original
 * file's permission bits where possible (the file holds secrets).
 */
async function writeCodexAuth(path, next) {
  const tmp = `${path}.dsh-${process.pid}-${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  try {
    await rename(tmp, path);
  } catch (error) {
    try {
      await import("node:fs/promises").then(({ unlink }) => unlink(tmp));
    } catch {}
    throw error;
  }
}

/**
 * Refresh the ChatGPT OAuth token pair and persist it back to the Codex
 * credential file. Refreshing shares one in-flight promise so concurrent LLM
 * requests trigger a single refresh.
 * @param path - credential file path.
 * @returns the fresh access token.
 */
export async function refreshCodexToken(path = defaultCodexAuthPath()) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const data = await readCodexAuth(path);
    const refreshToken = data?.tokens?.refresh_token;
    if (!refreshToken) {
      throw new Error(`local-token: no tokens.refresh_token in ${path} — re-login with the Codex CLI (` + 'codex login' + `)`);
    }
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`local-token: token refresh failed (${response.status}) ${text.slice(0, 200)}`);
    }
    const json = await response.json();
    const next = {
      ...data,
      tokens: {
        id_token: json.id_token ?? data.tokens.id_token,
        access_token: json.access_token,
        refresh_token: json.refresh_token ?? data.tokens.refresh_token,
        account_id: data.tokens.account_id,
      },
      last_refresh: new Date().toISOString(),
    };
    await writeCodexAuth(path, next);
    return next.tokens.access_token;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Resolve the access token for an LLM request, refreshing when it is close to
 * expiry. Throws when no credential exists so the caller reports a clear
 * MISSING_CREDENTIAL-style failure instead of sending an unauthenticated call.
 * @param path - credential file path.
 * @returns the bearer access token.
 */
export async function resolveCodexAccessToken(path = defaultCodexAuthPath()) {
  const data = await readCodexAuth(path);
  const token = data?.tokens?.access_token;
  if (!token) {
    throw new Error(`local-token: no tokens.access_token in ${path} — run the Codex CLI (` + 'codex login' + `) to sign in first`);
  }
  if (isFresh(token)) return token;
  return refreshCodexToken(path);
}

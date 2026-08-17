import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
/** The Keychain path exists on macOS only; other platforms use the file store. */
const HAS_KEYCHAIN = process.platform === "darwin";
const SERVICE = "Claude Code-credentials";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const CLIENT_ID = Buffer.from("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl", "base64").toString("utf8");
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export const defaultClaudeAuthPath = () => join(homedir(), ".claude", ".credentials.json");

function parseSecurityPassword(stdout, stderr) {
  const combined = [stdout, stderr].filter(Boolean).join("\n");
  const line = combined.split("\n").find((entry) => entry.startsWith("password: "));
  if (!line) throw new Error("security output did not contain a password line");
  let raw = line.slice("password: ".length);
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
  return raw;
}

async function readKeychainJson(service = SERVICE) {
  const { stdout, stderr } = await execFileAsync("security", ["find-generic-password", "-s", service, "-g"], { maxBuffer: 1024 * 1024 });
  return JSON.parse(parseSecurityPassword(stdout, stderr));
}

async function writeKeychainJson(data, service = SERVICE, account = userInfo().username) {
  await execFileAsync("security", ["add-generic-password", "-U", "-a", account, "-s", service, "-w", JSON.stringify(data)], { maxBuffer: 1024 * 1024 });
}

async function refreshClaudeKeychainToken(data, options = {}) {
  const current = data?.claudeAiOauth;
  const refreshToken = current?.refreshToken;
  if (!refreshToken) throw new Error("Claude Keychain entry has no claudeAiOauth.refreshToken");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", client_id: CLIENT_ID, refresh_token: refreshToken }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Claude token refresh failed (${response.status}): ${text.slice(0, 300)}`);
  const json = JSON.parse(text);
  const next = {
    ...data,
    claudeAiOauth: {
      ...current,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? current.refreshToken,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - REFRESH_SKEW_MS,
    },
  };
  await writeKeychainJson(next, options.service, options.account);
  return next.claudeAiOauth.accessToken;
}

async function readLegacyClaudeCredentialsFile(path) {
  const raw = await readFile(path, "utf8");
  const creds = JSON.parse(raw);
  const first = creds?.tokens?.[0];
  const token = first?.accessToken ?? first?.authToken ?? creds?.accessToken;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

export async function resolveClaudeAccessToken(options = {}) {
  // Old Claude Code builds wrote ~/.claude/.credentials.json. Prefer it when present.
  const filePath = options.filePath ?? defaultClaudeAuthPath();
  try {
    const token = await readLegacyClaudeCredentialsFile(filePath);
    if (token) return token;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  // New Claude Code builds store the account OAuth payload in macOS Keychain.
  // Elsewhere the file above is the only store, so say so plainly rather than
  // shelling out to a tool that does not exist.
  if (!HAS_KEYCHAIN) {
    throw new Error(`llm-local-token: no Claude credentials at ${filePath} (Keychain lookup is macOS-only on ${process.platform})`);
  }
  const service = options.service ?? SERVICE;
  const data = await readKeychainJson(service);
  const oauth = data?.claudeAiOauth;
  const token = oauth?.accessToken;
  if (typeof token !== "string" || token.length === 0) throw new Error(`Claude Keychain service "${service}" has no claudeAiOauth.accessToken`);
  if (typeof oauth.expiresAt === "number" && oauth.expiresAt - Date.now() <= REFRESH_SKEW_MS) {
    return refreshClaudeKeychainToken(data, { service, account: options.account });
  }
  return token;
}

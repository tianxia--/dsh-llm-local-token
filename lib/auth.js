// Authorization state + login orchestration for the two local-token routes.
//
// The Models settings page shows one card per provider route; this module is
// what that card reads. It answers two questions — "is this machine signed in
// right now?" and "start the CLI's own login for me" — and never stores a
// secret itself: the CLI's credential file (or Keychain entry) stays the single
// source of truth, exactly as it is for a model request.
import { stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { claudeCredentialMeta, defaultClaudeAuthPath, resolveClaudeAccessToken } from "./claude-keychain.js";
import { defaultCodexAuthPath, readCodexAuth } from "./token-store.js";

/** How long a login may stay open before the card gives up on it. */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
/** How often a pending login re-reads the credential store. */
const LOGIN_POLL_MS = 2000;
/** Keep only the tail of the CLI's chatter; the card shows a hint line at most. */
const LOG_TAIL = 4000;
/** The CLI prints the page to open on its own line; that URL is the whole UI. */
const URL_PATTERN = /https:\/\/[^\s"'<>]+/;
/**
 * Escape sequences a CLI wraps around help text: OSC-8 hyperlinks (`ESC ] 8 ; ;
 * <url> BEL`), colour codes, and stray single-character escapes. Left in, an
 * OSC-8 link both duplicates the URL and drags a BEL into the href.
 */
const ANSI_PATTERN = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b[@-Z\\-_]/g;

/**
 * Strip terminal escapes and control bytes from one CLI chunk, keeping the
 * whitespace that separates a URL from whatever follows it.
 * @param text - raw process output.
 * @returns the visible text.
 */
function visible(text) {
  return text.replace(ANSI_PATTERN, " ").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ");
}

/**
 * The providers this plugin can authorize, in card order. `command` is the
 * CLI's own login entry point: the same tool the credential file belongs to,
 * so an authorization here and a `codex login` in a terminal are the same act.
 */
const AUTH_PROVIDERS = [
  {
    provider: "openai-codex",
    displayName: "OpenAI Codex (local token)",
    command: () => [process.env.CODEX_BIN ?? "codex", ["login"]],
  },
  {
    provider: "anthropic",
    displayName: "Claude (local token)",
    command: () => [process.env.CLAUDE_BIN ?? "claude", ["setup-token"]],
  },
];

/** Decode a JWT's `exp` claim in milliseconds, or undefined. */
function jwtExpMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

/** Short, human-readable failure text; the card shows one line. */
function reasonOf(error) {
  const message = String(error?.message ?? error ?? "").trim();
  if (error?.code === "ENOENT") return "credential file not found";
  return message.length === 0 ? "not signed in" : message.slice(0, 240);
}

/**
 * Build the authorization service the host exposes to the Models card.
 * @param options.codexAuthPath - Codex credential file.
 * @param options.claudeAuthPath - legacy Claude credential file.
 * @param options.claudeKeychainService - Keychain service for Claude OAuth.
 * @param options.claudeKeychainAccount - optional Keychain account pin.
 * @param options.onAuthorized - called once a login succeeds for a provider.
 * @param options.logger - host logger.
 * @returns status/start/cancel/input/dispose faces plus provider metadata.
 */
export function createAuthService(options) {
  const {
    codexAuthPath = defaultCodexAuthPath(),
    claudeAuthPath = defaultClaudeAuthPath(),
    claudeKeychainService = "Claude Code-credentials",
    claudeKeychainAccount,
    onAuthorized = () => {},
    logger = { info: () => {}, warn: () => {} },
  } = options ?? {};

  /** provider id -> live login session */
  const sessions = new Map();

  /** Read the Codex credential file and describe it without trusting it blindly. */
  async function describeCodex() {
    try {
      const document = await readCodexAuth(codexAuthPath);
      const token = document?.tokens?.access_token;
      if (typeof token !== "string" || token.length === 0) {
        return { authorized: false, reason: "auth.json carries no access_token", source: codexAuthPath };
      }
      return {
        authorized: true,
        source: codexAuthPath,
        account: document?.tokens?.account_id ?? document?.account_id ?? null,
        expiresAt: jwtExpMs(token) ?? null,
      };
    } catch (error) {
      return { authorized: false, reason: reasonOf(error), source: codexAuthPath };
    }
  }

  /** Resolve the Claude OAuth token exactly as a request would. */
  async function describeClaude() {
    try {
      await resolveClaudeAccessToken({
        filePath: claudeAuthPath,
        service: claudeKeychainService,
        ...(claudeKeychainAccount === undefined ? {} : { account: claudeKeychainAccount }),
      });
      // The metadata read mirrors the resolver, so the card names the store that
      // actually supplied this token instead of assuming the Keychain.
      const meta = await claudeCredentialMeta({
        filePath: claudeAuthPath,
        service: claudeKeychainService,
        ...(claudeKeychainAccount === undefined ? {} : { account: claudeKeychainAccount }),
      });
      return {
        authorized: true,
        source: meta.store ?? (process.platform === "darwin" ? `Keychain: ${claudeKeychainService}` : claudeAuthPath),
        ...(meta.expiresAt === undefined ? {} : { expiresAt: meta.expiresAt }),
      };
    } catch (error) {
      return { authorized: false, reason: reasonOf(error), source: claudeAuthPath };
    }
  }

  const describe = (provider) => (provider === "anthropic" ? describeClaude() : describeCodex());

  /** The card-facing view of one session (never the child handle). */
  function viewOf(session) {
    if (session === undefined) return { state: "idle" };
    return {
      state: session.state,
      startedAt: session.startedAt,
      url: session.url ?? null,
      error: session.error ?? null,
      hint: session.hint ?? null,
    };
  }

  /** Record one CLI output line: the URL is the only thing worth surfacing. */
  function absorb(session, chunk) {
    session.log = (session.log + visible(chunk)).slice(-LOG_TAIL);
    if (session.url !== undefined && session.url !== null) return;
    const match = session.log.match(URL_PATTERN);
    if (match === null) return;
    // A URL that ends a sentence keeps the punctuation out of the link.
    session.url = match[0].replace(/[),.;]+$/, "");
    session.state = "waiting";
    logger.info(`llm-local-token: ${session.provider} login is waiting for the browser (${session.url.slice(0, 80)}…)`);
  }

  /** Tear a session down without touching the credential store. */
  function release(session) {
    if (session.timer !== undefined) clearTimeout(session.timer);
    if (session.poll !== undefined) clearInterval(session.poll);
    if (session.deadline !== undefined) clearTimeout(session.deadline);
    session.timer = undefined;
    session.poll = undefined;
    session.deadline = undefined;
    if (session.child !== undefined && session.child.exitCode === null) {
      try {
        session.child.kill();
      } catch {
        /* already gone */
      }
    }
  }

  /** Close a session as authorized: the credential store is the confirmation. */
  async function settle(session, authorized) {
    if (session.state === "authorized" || session.state === "failed") return;
    if (authorized) {
      session.state = "authorized";
      session.error = null;
      release(session);
      logger.info(`llm-local-token: ${session.provider} login succeeded`);
      try {
        await onAuthorized(session.provider);
      } catch (error) {
        logger.warn(`llm-local-token: post-authorization hook failed: ${reasonOf(error)}`);
      }
      return;
    }
    session.state = "failed";
    session.error = session.error ?? "the CLI exited before the login completed";
    release(session);
  }

  /**
   * A cheap fingerprint of the credential store, used to tell "this machine was
   * already signed in" from "the login just wrote a new credential".
   * @param provider - route id.
   * @returns an opaque comparable string.
   */
  async function fingerprint(provider) {
    try {
      if (provider === "anthropic") return `token:${await resolveClaudeAccessToken({ filePath: claudeAuthPath, service: claudeKeychainService, ...(claudeKeychainAccount === undefined ? {} : { account: claudeKeychainAccount }) })}`;
      const info = await stat(codexAuthPath);
      return `file:${info.mtimeMs}:${info.size}`;
    } catch {
      return "missing";
    }
  }

  /**
   * One poll of the credential store while a login is open. A credential that
   * was already valid when the login started proves nothing — re-authorizing
   * keeps the old one usable until the CLI rewrites it — so the store has to
   * actually change before a login counts as done.
   */
  async function poll(session) {
    if (session.state !== "waiting" && session.state !== "starting") return;
    const [status, current] = await Promise.all([describe(session.provider), fingerprint(session.provider)]);
    if (!status.authorized) return;
    const baseline = await session.baseline;
    if (current === baseline) return;
    await settle(session, true);
  }

  /**
   * Start the CLI's own login for one provider.
   * @param provider - route id.
   * @returns the session view, or undefined for an unknown provider.
   */
  function start(provider) {
    const spec = AUTH_PROVIDERS.find((entry) => entry.provider === provider);
    if (spec === undefined) return undefined;
    const open = sessions.get(provider);
    if (open !== undefined && (open.state === "starting" || open.state === "waiting")) return viewOf(open);

    const [bin, args] = spec.command();
    const session = { provider, state: "starting", startedAt: new Date().toISOString(), log: "", url: null, error: null, baseline: fingerprint(provider) };
    sessions.set(provider, session);

    let child;
    try {
      child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    } catch (error) {
      session.state = "failed";
      session.error = `could not start ${bin}: ${reasonOf(error)}`;
      return viewOf(session);
    }
    session.child = child;
    child.stdout?.on("data", (chunk) => absorb(session, String(chunk)));
    child.stderr?.on("data", (chunk) => absorb(session, String(chunk)));
    child.on("error", (error) => {
      session.state = "failed";
      session.error = error?.code === "ENOENT" ? `${bin} was not found on PATH — install the CLI, or set its path for this plugin` : reasonOf(error);
      release(session);
    });
    child.on("close", (code) => {
      void (async () => {
        const status = await describe(provider);
        if (status.authorized) await settle(session, true);
        else if (session.state !== "failed") {
          session.state = "failed";
          session.error = `the login command exited with code ${String(code)} before a credential appeared`;
          release(session);
        }
      })();
    });

    session.poll = setInterval(() => void poll(session), LOGIN_POLL_MS);
    session.deadline = setTimeout(() => {
      if (session.state === "authorized" || session.state === "failed") return;
      session.state = "failed";
      session.error = "timed out waiting for the authorization";
      release(session);
    }, LOGIN_TIMEOUT_MS);
    if (typeof session.poll?.unref === "function") session.poll.unref();
    if (typeof session.deadline?.unref === "function") session.deadline.unref();

    logger.info(`llm-local-token: started ${bin} ${args.join(" ")} for ${provider}`);
    return viewOf(session);
  }

  /** Abandon a pending login; the CLI process is killed with it. */
  function cancel(provider) {
    const session = sessions.get(provider);
    if (session === undefined) return { state: "idle" };
    if (session.state === "starting" || session.state === "waiting") {
      session.state = "cancelled";
      session.error = null;
      release(session);
    }
    return viewOf(session);
  }

  /**
   * Forward one line of user input to the CLI's stdin. Some login flows (Claude
   * Code's) ask the user to paste an authorization code back into the terminal;
   * the browser card collects it instead.
   * @param provider - route id.
   * @param text - the code, without a trailing newline.
   * @returns whether the input reached a live process.
   */
  function input(provider, text) {
    const session = sessions.get(provider);
    if (session === undefined || session.child === undefined || session.child.exitCode !== null) return false;
    if (typeof text !== "string" || text.length === 0) return false;
    try {
      session.child.stdin?.write(text.endsWith("\n") ? text : `${text}\n`);
      return true;
    } catch {
      return false;
    }
  }

  /** Everything the Models card renders, in one round trip. */
  async function status() {
    const providers = [];
    for (const spec of AUTH_PROVIDERS) {
      const described = await describe(spec.provider);
      providers.push({
        provider: spec.provider,
        displayName: spec.displayName,
        ...described,
        login: viewOf(sessions.get(spec.provider)),
      });
    }
    return { providers, fetchedAt: new Date().toISOString() };
  }

  /** Stop every pending login when the plugin unloads. */
  function dispose() {
    for (const session of sessions.values()) release(session);
    sessions.clear();
  }

  return { status, start, cancel, input, dispose, providers: AUTH_PROVIDERS.map(({ provider, displayName }) => ({ provider, displayName })) };
}

// Auth-smoke: drive the Models-page sign-in routes through the real plugin
// entry with a stub webServer, so a broken handler shape fails here instead of
// in the browser. Nothing is spawned: the login verbs are only checked for
// their validation replies.
import { apply } from "../lib/index.js";

const noop = () => {};
const handlers = [];
const events = new Map();
let handler;
const ctx = {
  logger: { info: noop, warn: noop, error: noop },
  llm: {
    registerAdapter: () => ({ replace: noop }),
    listConfigurableProviders: () => [
      { provider: "openai-codex", settingsNs: "llm-pi-ai", settingsPath: ["providers", "openai-codex"] },
      { provider: "anthropic", settingsNs: "llm-pi-ai", settingsPath: ["providers", "anthropic"] },
    ],
  },
  inject: (names, callback) => {
    if (names.includes("webServer")) {
      callback({
        logger: ctx.logger,
        effect: (fn) => fn(),
        on: noop,
        webServer: { register: (route) => { handlers.push(route.handler); return noop; } },
      });
    }
  },
  get: () => undefined,
  setTimeout: noop,
  setInterval: noop,
  effect: noop,
  on: (event, fn) => {
    events.set(event, [...(events.get(event) ?? []), fn]);
  },
};

await apply(ctx, { glmQuota: false, usageProbe: false });
if (handlers.length === 0) throw new Error("the web routes were not mounted");
// Two routes share the prefix; the first is the usage/auth dispatcher.
handler = handlers[0];

/** One request against the mounted handler. */
function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const listeners = new Map();
    const req = {
      method,
      url: path,
      on: (event, fn) => {
        listeners.set(event, [...(listeners.get(event) ?? []), fn]);
        return req;
      },
      destroy: noop,
    };
    const res = {
      status: 0,
      body: "",
      writeHead(status) {
        this.status = status;
      },
      end(text) {
        this.body = text;
        try {
          resolve({ status: this.status, json: JSON.parse(text) });
        } catch (error) {
          reject(error);
        }
      },
    };
    handler(req, res);
    if (body !== undefined) {
      for (const fn of listeners.get("data") ?? []) fn(Buffer.from(JSON.stringify(body)));
    }
    for (const fn of listeners.get("end") ?? []) fn();
  });
}

const status = await call("GET", "/llm-local-token/auth");
if (status.status !== 200) throw new Error(`GET /auth -> ${status.status} ${status.body}`);
const providers = status.json.providers ?? [];
if (providers.length !== 2) throw new Error(`expected 2 providers, got ${providers.map((p) => p.provider).join(",")}`);
if (!providers.some((p) => p.provider === "openai-codex" && typeof p.authorized === "boolean")) {
  throw new Error(`codex row malformed: ${JSON.stringify(providers[0])}`);
}
if (!providers.every((p) => p.login?.state === "idle")) throw new Error("a fresh plugin reported an open login");

const unknown = await call("POST", "/llm-local-token/auth/login", { provider: "nope" });
if (unknown.status !== 400) throw new Error(`unknown provider -> ${unknown.status}`);

const missing = await call("POST", "/llm-local-token/auth/login", {});
if (missing.status !== 400) throw new Error(`missing provider -> ${missing.status}`);

const wrongVerb = await call("DELETE", "/llm-local-token/auth");
if (wrongVerb.status !== 405) throw new Error(`DELETE /auth -> ${wrongVerb.status}`);

const usage = await call("GET", "/llm-local-token/usage");
if (usage.status !== 200 || !Array.isArray(usage.json.providers)) throw new Error(`usage route regressed: ${usage.status}`);

// The page-bootstrap global tells the browser half which slot keys to mount under.
const table = [];
for (const fn of events.get("webserver/index-inject") ?? []) fn(table);
const published = table.find((entry) => entry.name === "__DSH_LLM_LOCAL_TOKEN__")?.value;
if (published === undefined) throw new Error("the page-bootstrap global was not published");
if (!published.slotKeys.includes("llm-pi-ai")) throw new Error(`slot keys lack the directory namespace: ${published.slotKeys}`);
if (published.authRoute !== "/llm-local-token/auth") throw new Error(`authRoute is ${published.authRoute}`);

console.log("PASS: auth routes serve", providers.map((p) => `${p.provider}=${p.authorized ? "authorized" : "missing"}`).join(", "));
process.exit(0);

// Client-smoke: execute the browser bundle the way the dsh web runtime does,
// call its apply() with stub services, then RENDER the Models sign-in card and
// assert what the user actually sees:
//
//   - both Models seats are registered (per-row card + section footer),
//   - a signed-out route offers a sign-in button,
//   - a signed-in route offers NO button at all.
//
// The last two are the behaviours most likely to regress silently, and the
// only ones a human was checking by eye.
import { readFileSync } from "node:fs";

const src = readFileSync(process.argv[2] + "/lib/client.js", "utf8");

/**
 * Hook state, per component instance. Each card owns its own snapshot state, so
 * the stub has to start a fresh slot list per rendered component — sharing one
 * queue would hand the second card the first card's leftovers.
 */
let instance = { states: [], index: 0 };
const react = {
  useState: (value) => {
    const index = instance.index++;
    if (index >= instance.states.length) instance.states.push(typeof value === "function" ? value() : value);
    return [instance.states[index], () => {}];
  },
  useEffect: () => {},
  useRef: (value) => ({ current: value ?? null }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  createElement: (type, props) => ({ type, props }),
  Fragment: "Fragment",
};

/** Render one component with a fresh hook state, seeded with its snapshot. */
function withInstance(seed, render) {
  const saved = instance;
  instance = { states: [seed, "", false, ""], index: 0 };
  try {
    return render();
  } finally {
    instance = saved;
  }
}
const build = (type, props, key) => ({ type, props: props ?? {}, key });
const jsxRuntime = { jsx: build, jsxs: build, Fragment: "Fragment" };
const clientStore = { createSnapshotStore: (state) => ({ get: () => state, getSnapshot: () => state }) };

const stubRequire = (spec) => {
  if (spec === "react/jsx-runtime") return jsxRuntime;
  if (spec === "react") return react;
  if (spec === "@deepseek-ai/dsh-client-store") return clientStore;
  throw new Error("unstubbed require: " + spec);
};

const match = src.match(/factory: \(require\) => \{[\s\S]*\n\}\);?[\s\S]*$/);
if (!match) throw new Error("FAIL: factory not found");
const factorySrc = "return (require) => {" + match[0].slice("factory: (require) => {".length).replace(/\n\}\);\s*$/, "\n");
const factory = new Function(factorySrc)();
// The bundle declares its own `module`/`exports` inside the factory and returns it.
const loaded = factory(stubRequire);

// ── apply(): capture every slot registration ────────────────────────────────
const registrations = [];
const ctx = {
  effect: (fn) => fn(),
  locale: { register: () => {} },
  get: () => undefined,
  slots: {
    inject: (name, callback) => callback(),
    register: (options, component) => registrations.push({ options, component }),
  },
};
loaded.apply(ctx);

const names = registrations.map((entry) => entry.options.name);
const footer = registrations.find((entry) => entry.options.name === "settings.models.footer");
if (footer === undefined) throw new Error(`FAIL: footer seat not registered (got ${names.join(", ")})`);
const rowKeys = registrations.filter((entry) => entry.options.name === "settings.models.provider-card").map((entry) => entry.options.key);
for (const key of ["llm-pi-ai", ""]) {
  if (!rowKeys.includes(key)) throw new Error(`FAIL: provider-card seat missing key "${key}" (got ${JSON.stringify(rowKeys)})`);
}
if (footer.options.key !== undefined) throw new Error("FAIL: the footer is a list slot; it takes an id, not a key");
if (typeof footer.options.id !== "string" || footer.options.id.length === 0) throw new Error("FAIL: footer list entry needs an id");

// ── render the footer with a stub translator ────────────────────────────────
const t = (key, params) => (params === undefined ? key : `${key}(${Object.values(params).join(",")})`);
const collect = (node, out, seed) => {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out, seed);
    return out;
  }
  // Function components in the tree (the per-provider card) render on the spot,
  // the way React would with the same props.
  if (typeof node.type === "function") {
    return collect(withInstance(seed, () => node.type({ ...node.props })), out, seed);
  }
  const children = node.props?.children;
  if (Array.isArray(children)) for (const child of children) collect(child, out, seed);
  else collect(children, out, seed);
  // Buttons carry their label in props.children already; links carry href.
  if (typeof node.props?.href === "string") out.push(node.props.href);
  return out;
};

/** Render the footer for one status snapshot and return its visible text. */
function renderFooter(status) {
  // AuthCardBody calls useState in order: snapshot, error, busy, code.
  const tree = footer.component({ t });
  return collect(tree, [], status).join(" | ");
}

const signedOut = renderFooter({
  providers: [
    { provider: "openai-codex", authorized: false, reason: "credential file not found", login: { state: "idle" } },
    { provider: "anthropic", authorized: false, reason: "no credentials", login: { state: "idle" } },
  ],
});
if (!signedOut.includes("card.signin")) throw new Error(`FAIL: a signed-out route must offer sign-in, got: ${signedOut}`);
if (!signedOut.includes("card.off")) throw new Error(`FAIL: a signed-out route must read as unauthorized, got: ${signedOut}`);

const signedIn = renderFooter({
  providers: [
    { provider: "openai-codex", authorized: true, account: "acct-1", expiresAt: Date.UTC(2026, 10, 13, 6, 6), source: "/tmp/auth.json", login: { state: "idle" } },
    { provider: "anthropic", authorized: true, source: "Keychain: Claude Code-credentials", login: { state: "idle" } },
  ],
});
if (signedIn.includes("card.signin")) throw new Error(`FAIL: an authorized route must not offer a sign-in button, got: ${signedIn}`);
if (!signedIn.includes("card.ok")) throw new Error(`FAIL: an authorized route must read as authorized, got: ${signedIn}`);
if (!signedIn.includes("acct-1")) throw new Error(`FAIL: the account is missing from the card, got: ${signedIn}`);
if (!signedIn.includes("Keychain: Claude Code-credentials")) throw new Error(`FAIL: the credential source is missing, got: ${signedIn}`);

// A failed *re*-authorization on a working route must not raise an alarm.
const reAuthFailed = renderFooter({
  providers: [
    { provider: "openai-codex", authorized: true, login: { state: "failed", error: "timed out waiting for the authorization" } },
    { provider: "anthropic", authorized: true, login: { state: "idle" } },
  ],
});
if (reAuthFailed.includes("timed out waiting for the authorization")) {
  throw new Error(`FAIL: a stale re-authorization failure is reported on a working route: ${reAuthFailed}`);
}

// A pending login shows its authorization page instead of a fresh sign-in.
const waiting = renderFooter({
  providers: [
    {
      provider: "openai-codex",
      authorized: false,
      login: { state: "waiting", url: "https://auth.example/oauth?code=1", error: null },
    },
    { provider: "anthropic", authorized: true, login: { state: "idle" } },
  ],
});
if (!waiting.includes("https://auth.example/oauth?code=1")) throw new Error(`FAIL: the authorization URL is not offered, got: ${waiting}`);
if (!waiting.includes("card.cancel")) throw new Error(`FAIL: a pending login must be cancellable, got: ${waiting}`);
if (waiting.includes("card.signin")) throw new Error(`FAIL: a pending login still offered a fresh sign-in, got: ${waiting}`);

console.log("PASS: seats", [...new Set(names)].join(", "), "| rowKeys", JSON.stringify(rowKeys));
console.log("PASS: card rendering — signed out shows sign-in, signed in shows none, stale failure hidden, pending shows URL");
process.exit(0);

// Load-smoke: actually EXECUTE lib/client.js the same way the dsh web
// runtime does — factory(require) with stubbed host deps — so a bundle that
// would fail to load in the browser fails HERE, before it ships.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const src = readFileSync(process.argv[2] + "/lib/client.js", "utf8");

const jsxRuntime = { jsx: (t, p) => ({ t, p }), jsxs: (t, p) => ({ t, p }), Fragment: "Fragment" };
const react = { useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useEffect: () => {}, useRef: (v) => ({ current: v ?? null }), useCallback: (f) => f, useMemo: (f) => f() };
const clientStore = { createSnapshotStore: (s) => ({ get: () => s }) };
const stubRequire = (spec) => {
  if (spec === "react/jsx-runtime") return jsxRuntime;
  if (spec === "react") return react;
  if (spec === "@deepseek-ai/dsh-client-store") return clientStore;
  throw new Error("unstubbed require: " + spec);
};

// The bundle is window.__ModuleLoader__.load({ id, factory }); extract the
// factory source and execute it with the stub require.
const m = src.match(/factory: \(require\) => \{[\s\S]*\n\}\);?[\s\S]*$/);
if (!m) { console.error("FAIL: factory not found"); process.exit(1); }
const factorySrc = "return (require) => {" + m[0].slice("factory: (require) => {".length).replace(/\n\}\);\s*$/, "\n");
try {
  const factory = new Function(factorySrc)();
  const module = { exports: {} };
  factory(stubRequire);
  console.log("PASS: bundle executes and registers cleanly");
} catch (e) {
  console.error("FAIL: bundle threw on load —", e.message);
  console.error(e.stack.split("\n").slice(0, 4).join("\n"));
  process.exit(1);
}
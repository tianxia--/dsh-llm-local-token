// Image-clamp check: the long-edge clamp must survive both host generations.
//
// dsh 0.1 hands `readImageRequest` a POLICY `{ maxPixels, maxBytes }`; dsh 0.2
// hands it a TARGET `{ width, height, maxBytes }` whose dimensions the adapter
// already computed. A clamp that only knows the 0.1 shape writes a `maxPixels`
// field nobody reads on 0.2 and the 2000px rejection comes straight back —
// silently, because nothing throws. This asserts both shapes.
import { clampedImageTarget, resolveMaxEdge, PROVIDER_HARD_EDGE_LIMIT } from "../lib/image-policy.js";

const E = resolveMaxEdge(undefined);
const BUDGET = { maxPixels: 1_150_000, maxBytes: 1_048_576 };
const fail = (message) => {
  throw new Error(message);
};

// — dsh 0.2 shape: explicit dimensions must come back clamped —
for (const [w, h] of [[2048, 79], [8000, 50], [50, 8000], [12000, 1], [2001, 2000]]) {
  const out = clampedImageTarget({ width: w, height: h }, { width: w, height: h, maxBytes: BUDGET.maxBytes }, E);
  const edge = Math.max(out.width, out.height);
  if (edge > E) fail(`0.2 target ${w}x${h} left a ${edge}px edge (cap ${E})`);
  if (edge > PROVIDER_HARD_EDGE_LIMIT) fail(`0.2 target ${w}x${h} exceeds the provider hard limit`);
  if (out.width > w || out.height > h) fail(`0.2 target ${w}x${h} was enlarged to ${out.width}x${out.height}`);
  if ("maxPixels" in out) fail(`0.2 target ${w}x${h} got an ignored maxPixels field instead of real dimensions`);
}

// — dsh 0.1 shape: the area budget must be lowered enough to bound the edge —
//
// Mirrors the attachment provider's own `requestImageDimensions`: scale by
// area, then shrink the long side until the area fits. A plain
// `floor(long * scale)` is not the same function and would misjudge thin
// strips, so the shrink loop is reproduced here.
const projectByArea = (width, height, maxPixels) => {
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
  if (scale === 1) return { width, height };
  const wide = width >= height;
  const long = wide ? width : height;
  const ratio = (wide ? height : width) / long;
  let projected = Math.max(1, Math.floor(long * scale));
  let other = Math.max(1, Math.round(projected * ratio));
  while (projected * other > maxPixels && projected > 1) {
    projected -= 1;
    other = Math.max(1, Math.round(projected * ratio));
  }
  return wide ? { width: projected, height: other } : { width: other, height: projected };
};

for (const [w, h] of [[2048, 79], [8000, 50], [484, 2060], [12000, 1]]) {
  const out = clampedImageTarget({ width: w, height: h }, BUDGET, E);
  if (!(out.maxPixels > 0)) fail(`0.1 policy ${w}x${h} produced no budget`);
  const projected = projectByArea(w, h, out.maxPixels);
  const edge = Math.max(projected.width, projected.height);
  if (edge > E) fail(`0.1 policy ${w}x${h} still projects to ${edge}px (cap ${E})`);
  if (projected.width > w || projected.height > h) fail(`0.1 policy ${w}x${h} was enlarged`);
}

// — images already inside the cap must pass through by identity (cache key) —
const smallTarget = { width: 800, height: 600, maxBytes: 1 };
if (clampedImageTarget({ width: 800, height: 600 }, smallTarget, E) !== smallTarget) fail("0.2 small target was rewritten");
if (clampedImageTarget({ width: 800, height: 600 }, BUDGET, E) !== BUDGET) fail("0.1 small policy was rewritten");

// — a junk reference must never throw or mangle the target —
if (clampedImageTarget(undefined, BUDGET, E) !== BUDGET) fail("missing ref did not pass the policy through");

console.log(`PASS: long-edge clamp holds at ${E}px on both the 0.1 policy and the 0.2 target shape`);

// Per-edge clamp for model-request images.
//
// Why this exists
// ---------------
// Anthropic rejects a request whose images exceed 2000px on either edge once
// the request carries more than 20 images:
//
//   messages.164.content.1.image.source.base64.data: At least one of the image
//   dimensions exceed max allowed size for many-image requests: 2000 pixels
//
// The harness already downscales request images, but `dsh-attachment`'s
// projection (`requestImageDimensions`) is **area-only**: it takes a
// `maxPixels` budget and scales by `sqrt(maxPixels / (w*h))`, with no long-edge
// cap. Aspect ratio is therefore unbounded, so an area budget alone can never
// bound an edge:
//
//   longEdge = sqrt(maxPixels * longEdge/shortEdge)
//
// A 2400x160 strip is only 384k pixels — it slips under any sane budget
// untouched and still arrives 2400px wide. Lowering the budget just moves the
// ratio at which it breaks (1M broke on 484x2060, 640k on 2069x309, 400k on
// anything past 10:1); it never fixes it, and it blurs every ordinary
// screenshot as the price.
//
// The fix: keep the route budget for area, and additionally derive, per image,
// the largest budget that provably keeps the long edge within `maxEdge`.
// Because the projection preserves aspect ratio, solving the identity above for
// the budget gives
//
//   maxPixels <= maxEdge^2 * shortEdge / longEdge
//
// Feeding that as the policy budget makes the harness's own scaler produce the
// clamped size — aspect ratio preserved, nothing cropped, no re-encoding here,
// and no image is ever enlarged. Images already within the cap are untouched.

/** Default long-edge cap, in pixels, applied to every request image. */
export const DEFAULT_REQUEST_IMAGE_MAX_EDGE = 1568;

/** Anthropic's hard per-edge limit for requests carrying more than 20 images. */
export const PROVIDER_HARD_EDGE_LIMIT = 2000;

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Resolve the configured long-edge cap, rejecting junk and anything above the
 * provider's hard limit (a larger cap could only reintroduce the 400 error).
 * @param value - `requestImageMaxEdge` from plugin config, possibly undefined.
 * @returns a usable pixel cap.
 */
export function resolveMaxEdge(value) {
  if (value === undefined) return DEFAULT_REQUEST_IMAGE_MAX_EDGE;
  const edge = Number(value);
  if (!positiveInteger(edge)) return DEFAULT_REQUEST_IMAGE_MAX_EDGE;
  return Math.min(edge, PROVIDER_HARD_EDGE_LIMIT);
}

/**
 * The per-image request target that keeps the projected long edge <= maxEdge.
 *
 * Two host generations hand `readImageRequest` two different shapes, and the
 * clamp has to recognize both:
 *
 *   - dsh 0.1 passes a POLICY `{ maxPixels, maxBytes }` and lets the attachment
 *     provider derive the dimensions. The lever is the area budget.
 *   - dsh 0.2 passes a TARGET `{ width, height, maxBytes }`: the adapter already
 *     ran `requestImageDimensions` itself, so the dimensions are right there
 *     and a `maxPixels` field is simply ignored. Writing a budget here would
 *     silently do nothing — the whole point of this module would evaporate on
 *     an upgrade.
 *
 * @param ref - durable image attachment reference (carries intrinsic w/h).
 * @param target - the route-owned `{ maxPixels, maxBytes }` or `{ width, height, maxBytes }`.
 * @param maxEdge - long-edge cap in pixels.
 * @returns the same object when no clamp is needed, otherwise a clamped copy.
 * Returning the identical object matters: the attachment provider hashes it
 * into the request-image cache key.
 */
export function clampedImageTarget(ref, target, maxEdge) {
  // dsh 0.2+: explicit dimensions, so clamp them directly and exactly.
  if (positiveInteger(target?.width) && positiveInteger(target?.height)) {
    const longEdge = Math.max(target.width, target.height);
    if (longEdge <= maxEdge) return target;
    const scale = maxEdge / longEdge;
    const wide = target.width >= target.height;
    return {
      ...target,
      width: wide ? maxEdge : Math.max(1, Math.round(target.width * scale)),
      height: wide ? Math.max(1, Math.round(target.height * scale)) : maxEdge,
    };
  }
  // dsh 0.1: area budget only. Derive the area of the ideal clamped image
  // (long edge == maxEdge, aspect ratio preserved, short edge rounded the way
  // the provider rounds it) so its own shrink loop lands on those dimensions;
  // a `maxEdge^2 * short / long` estimate undershoots once the short edge
  // rounds to a small integer.
  const width = ref?.width;
  const height = ref?.height;
  if (!positiveInteger(width) || !positiveInteger(height)) return target;
  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  // Projection never enlarges, so a source already within the cap cannot
  // produce an oversized request image.
  if (longEdge <= maxEdge) return target;
  const edgeBudget = maxEdge * Math.max(1, Math.round((maxEdge * shortEdge) / longEdge));
  const budget = target?.maxPixels;
  if (positiveInteger(budget) && budget <= edgeBudget) return target;
  return { ...target, maxPixels: edgeBudget };
}

/**
 * Wrap the durable attachment service so every model-request projection this
 * plugin asks for is edge-clamped. Every other member is forwarded untouched,
 * and methods still run with the real service as `this`, so provider-private
 * state keeps working.
 *
 * @param attachments - `ctx.get("attachments")`, possibly undefined when no
 * attachment provider is mounted.
 * @param maxEdge - long-edge cap in pixels.
 * @returns the wrapped service, or the input verbatim when there is nothing to
 * wrap.
 */
export function withRequestImageEdgeClamp(attachments, maxEdge) {
  if (attachments === undefined || attachments === null) return attachments;
  if (typeof attachments.readImageRequest !== "function") return attachments;
  return new Proxy(attachments, {
    get(target, property) {
      if (property === "readImageRequest") {
        return (ref, policy, signal) =>
          target.readImageRequest(ref, clampedImageTarget(ref, policy, maxEdge), signal);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

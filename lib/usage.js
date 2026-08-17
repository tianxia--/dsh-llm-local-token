// Live quota snapshots, read from the rate-limit headers each provider already
// returns. Nothing is polled: a snapshot is whatever the most recent real
// request reported, which is also the only moment the numbers can change.

/** Parse a numeric header, or undefined when absent/unparsable. */
function num(headers, name) {
  const raw = headers?.[name];
  if (raw === undefined || raw === null || String(raw).trim().length === 0) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function str(headers, name) {
  const raw = headers?.[name];
  return raw === undefined || raw === null ? undefined : String(raw).trim() || undefined;
}

/** Lower-case every header name so lookups do not depend on the transport. */
export function normalizeHeaders(headers) {
  const flat = {};
  if (headers === undefined || headers === null) return flat;
  const entries = typeof headers.entries === "function" ? [...headers.entries()] : Object.entries(headers);
  for (const [key, value] of entries) flat[String(key).toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  return flat;
}

/**
 * One usage window in the shape the panel renders: a 0..1 fraction, the window
 * length, and when it resets.
 */
function window_(label, usedPercent, windowMinutes, resetAt, status) {
  if (usedPercent === undefined) return undefined;
  return {
    label,
    used: Math.max(0, Math.min(usedPercent / 100, 1)),
    ...(windowMinutes === undefined ? {} : { windowMinutes }),
    ...(resetAt === undefined ? {} : { resetAt: new Date(resetAt * 1000).toISOString() }),
    ...(status === undefined ? {} : { status }),
  };
}

/**
 * Read the Codex/ChatGPT quota headers (`x-codex-*`).
 * @param headers - normalized response headers.
 * @returns the snapshot, or undefined when this response carried no quota data.
 */
export function codexUsage(headers) {
  const primary = window_(
    "primary",
    num(headers, "x-codex-primary-used-percent"),
    num(headers, "x-codex-primary-window-minutes"),
    num(headers, "x-codex-primary-reset-at"),
  );
  const secondary = window_(
    "secondary",
    num(headers, "x-codex-secondary-used-percent"),
    num(headers, "x-codex-secondary-window-minutes"),
    num(headers, "x-codex-secondary-reset-at"),
  );
  if (primary === undefined && secondary === undefined) return undefined;
  const credits = num(headers, "x-codex-credits-balance");
  return {
    provider: "openai-codex",
    plan: str(headers, "x-codex-plan-type"),
    activeLimit: str(headers, "x-codex-active-limit"),
    windows: [primary, secondary].filter((entry) => entry !== undefined && (entry.windowMinutes ?? 0) > 0),
    ...(credits === undefined ? {} : { credits, creditsUnlimited: str(headers, "x-codex-credits-unlimited") === "True" }),
    at: new Date().toISOString(),
  };
}

/**
 * Read the Anthropic unified rate-limit headers (`anthropic-ratelimit-unified-*`).
 * Utilization arrives as a 0..1 fraction there, unlike Codex's percent.
 * @param headers - normalized response headers.
 * @returns the snapshot, or undefined when this response carried no quota data.
 */
export function anthropicUsage(headers) {
  const windows = [];
  for (const [name, minutes] of [["5h", 300], ["7d", 10080]]) {
    const used = num(headers, `anthropic-ratelimit-unified-${name}-utilization`);
    if (used === undefined) continue;
    windows.push({
      label: name,
      used: Math.max(0, Math.min(used, 1)),
      windowMinutes: minutes,
      ...(num(headers, `anthropic-ratelimit-unified-${name}-reset`) === undefined
        ? {}
        : { resetAt: new Date(num(headers, `anthropic-ratelimit-unified-${name}-reset`) * 1000).toISOString() }),
      ...(str(headers, `anthropic-ratelimit-unified-${name}-status`) === undefined
        ? {}
        : { status: str(headers, `anthropic-ratelimit-unified-${name}-status`) }),
    });
  }
  if (windows.length === 0) return undefined;
  return {
    provider: "anthropic",
    ...(str(headers, "anthropic-ratelimit-unified-status") === undefined ? {} : { activeLimit: str(headers, "anthropic-ratelimit-unified-status") }),
    windows,
    at: new Date().toISOString(),
  };
}

/** Provider id to header reader. */
const READERS = { "openai-codex": codexUsage, anthropic: anthropicUsage };

/**
 * Wrap a pi-ai provider so every response's quota headers reach `record`.
 *
 * The engine calls `onResponse` with the raw status and headers before the
 * stream is consumed, and a caller-supplied hook is preserved, so this is a
 * pure observation: no request shape changes and no failure path is added.
 * @param provider - the pi-ai provider to wrap.
 * @param record - receives one parsed snapshot per response that carries quota headers.
 * @returns the wrapped provider.
 */
export function withUsageProbe(provider, record) {
  const read = READERS[provider.id];
  if (read === undefined) return provider;
  const observe = (options) => ({
    ...options,
    onResponse: async (response, model) => {
      try {
        const snapshot = read(normalizeHeaders(response?.headers));
        if (snapshot !== undefined) record(snapshot);
      } catch {
        // Usage reporting must never break a model call.
      }
      return options?.onResponse?.(response, model);
    },
  });
  return {
    ...provider,
    stream: (model, context, options) => provider.stream(model, context, observe(options)),
    streamSimple: (model, context, options) => provider.streamSimple(model, context, observe(options)),
  };
}

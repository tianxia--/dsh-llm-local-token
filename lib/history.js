// Quota history, written by the scheduled probe and read by the panel.
//
// One JSON object per line in ~/.dsh/usage-history/<provider>.jsonl. The file
// is rewritten whole on every write rather than appended to: pruning stale
// records needs a read-and-filter anyway, the file stays small (7 days of
// probes is ~40 lines), and a rewrite cannot leave a half-appended line
// behind. Writes are per-provider so a Codex probe never touches the Claude
// file.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const HISTORY_DAYS = 7;

const dir = () => join(process.env.DSH_HOME ?? join(process.env.HOME ?? "", ".dsh"), "usage-history");

/**
 * Add one snapshot to the provider's history and prune records older than
 * `days`. Every failure is swallowed: history must never take the probe down.
 */
export function appendHistory(provider, snapshot, { days = HISTORY_DAYS } = {}) {
  try {
    const file = join(dir(), provider + ".jsonl");
    const cutoff = Date.now() - days * 86400000;
    const kept = [];
    if (existsSync(file)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!line) continue;
        try { if (Date.parse(JSON.parse(line).at) >= cutoff) kept.push(line); } catch {}
      }
    }
    kept.push(JSON.stringify(snapshot));
    mkdirSync(dir(), { recursive: true });
    writeFileSync(file, kept.join("\n") + "\n");
    return true;
  } catch {
    return false;
  }
}

/** The provider's stored snapshots, oldest first, within the `days` window. */
export function readHistory(provider, { days = HISTORY_DAYS } = {}) {
  try {
    const file = join(dir(), provider + ".jsonl");
    if (!existsSync(file)) return [];
    const cutoff = Date.now() - days * 86400000;
    const out = [];
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line) continue;
      try {
        const record = JSON.parse(line);
        if (Date.parse(record.at) >= cutoff) out.push(record);
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

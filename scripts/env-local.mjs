import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads `.env.local` for scripts that would otherwise not see it.
 *
 * Narrow purpose: `next` and `bun` both read `.env.local` themselves, but plain
 * `node` does not, and `scripts/verify-daily-questions.mjs` has to run under node
 * (Bun's FormData multipart is rejected by Next's Server Action parser).
 *
 * Standard dotenv semantics: **existing values are left alone.** This is not a
 * mechanism for out-ranking the ambient environment — the reason a stale shell
 * export used to win is that the variable name was contested, and that is fixed
 * by the name itself (`DB_URL`), not by overriding anything here.
 */
export function loadEnvLocal(cwd = process.cwd()) {
  const path = join(cwd, ".env.local");
  if (!existsSync(path)) return [];

  const applied = [];

  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separator + 1).trim();

    // strip one layer of matching quotes, the way dotenv does
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);

    process.env[key] = value;
    applied.push(key);
  }

  return applied;
}

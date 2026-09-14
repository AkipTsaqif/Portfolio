import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Makes `.env.local` the source of truth, **overriding** anything already in
 * `process.env`.
 *
 * This is deliberately not the default behaviour of either runtime: Bun and Next
 * both leave an existing `process.env` value alone, and Node does not read
 * `.env.local` at all. That means a `DATABASE_URL` exported in your shell silently
 * wins over the one in `.env.local`, and you end up migrating the wrong database
 * without any warning. This was a real incident, not a hypothetical: the tool was
 * pointed at a shared database while `.env.local` named a dedicated one.
 *
 * Scope of the override:
 *   - local development, and any script run from this repo (dev, build, start,
 *     db:migrate, verify)
 *   - it is a no-op wherever `.env.local` does not exist, which is every deployed
 *     environment (the file is gitignored). Production still gets its values from
 *     the platform's own environment variables.
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
    if (!key) continue;

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

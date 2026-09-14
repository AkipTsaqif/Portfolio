import { neon } from "@neondatabase/serverless";
import { requireDatabaseUrl } from "./env";

/**
 * Neon over HTTP.
 *
 * The HTTP driver cannot hold a session across statements, so it offers no
 * `pg_advisory_lock` and no interactive transactions. Every write in this
 * feature is therefore written to be atomic on its own — `ON CONFLICT` for
 * inserts, and conditional `UPDATE ... WHERE status = 'pending'` for the
 * question publish. See `src/features/lab/daily-questions/questions.ts`.
 *
 * The client is created lazily so importing a module that uses it never throws
 * during `next build`.
 */
function createClient() {
  return neon(requireDatabaseUrl());
}

type Sql = ReturnType<typeof createClient>;

let cached: Sql | null = null;

export function db(): Sql {
  cached ??= createClient();
  return cached;
}

/** Rows come back loosely typed; every call site casts to a row type. */
export function rows<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : []) as T[];
}

export function firstRow<T>(result: unknown): T | null {
  return rows<T>(result)[0] ?? null;
}

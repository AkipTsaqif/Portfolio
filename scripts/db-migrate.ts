#!/usr/bin/env bun
/**
 * Applies src/lib/db/schema.sql to the database.
 *
 * Statements are separated by a line containing only `-- @@` (see the header of
 * schema.sql for why). Idempotent: safe to run repeatedly.
 *
 *   bun run db:migrate
 *
 * Neon's own guidance is that schema work belongs on a **direct** connection:
 * the pooled endpoint is PgBouncer in transaction mode, which does not carry
 * session-level state, and DDL is exactly the kind of thing that wants it. So
 * `DIRECT_URL` (Neon's name for it) wins when present and `DATABASE_URL` is the
 * fallback — which is what this script did before, and it worked, because every
 * statement here is self-contained. Being explicit just removes the exception.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const candidate =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!candidate) {
  console.error(
    "Missing DIRECT_URL and DATABASE_URL. Add one to .env.local and try again.",
  );
  process.exit(1);
}

const usingDirect = Boolean(process.env.DIRECT_URL?.trim());
const isPooled = /-pooler\./.test(new URL(candidate).hostname);

if (isPooled) {
  console.log(
    "note: migrating over the pooled endpoint. Set DIRECT_URL to the non-pooler " +
      "host to follow Neon's guidance for schema changes.",
  );
}

const schemaPath = join(process.cwd(), "src/lib/db/schema.sql");
const source = readFileSync(schemaPath, "utf8");

const statements = source
  .split(/^\s*--\s*@@\s*$/m)
  .map((statement) => statement.trim())
  .filter(Boolean);

const sql = neon(candidate);
let applied = 0;

for (const statement of statements) {
  const label = statement
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);

  try {
    await sql.query(statement);
    applied += 1;
    console.log(`  ok   ${label}`);
  } catch (error) {
    console.error(`  FAIL ${label}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

console.log(
  `\n${applied} statement(s) applied over the ${usingDirect ? "direct" : "pooled"} endpoint.`,
);
process.exit(0);

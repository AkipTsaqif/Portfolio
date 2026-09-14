/**
 * Database environment, co-located with the client the way `src/sanity/env.ts`
 * is co-located with Sanity's.
 *
 * The variable is `DB_URL`, not the conventional `DATABASE_URL`, on purpose.
 * `DATABASE_URL` is contested on a developer machine that has other projects
 * exporting it: whichever value the runtime happened to pick won, silently, and
 * migrations ran against the wrong database with no warning. A distinct name
 * removes the collision rather than trying to out-rank it.
 *
 * The trade-off is that a platform integration which injects `DATABASE_URL`
 * automatically (Neon on Vercel, Vercel Postgres, Railway) will not be picked up
 * until you point `DB_URL` at it. That is deliberate: a loud "missing" beats a
 * silent wrong database.
 *
 * Deliberately lazy: reading `process.env` at module load would run during
 * `next build`, and the Lab tool must build fine on a machine with no database
 * configured.
 */
export function getDatabaseUrl(): string | null {
  const url = process.env.DB_URL?.trim();
  return url ? url : null;
}

export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();

  if (!url) {
    throw new Error(
      "Missing DB_URL. Copy .env.example to .env.local and add your Neon connection string.",
    );
  }

  return url;
}

/** True when the tool has everything it needs to talk to Postgres. */
export function isDatabaseConfigured(): boolean {
  return getDatabaseUrl() !== null;
}

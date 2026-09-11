/**
 * Database environment, co-located with the client the way `src/sanity/env.ts`
 * is co-located with Sanity's.
 *
 * Deliberately lazy: reading `process.env` at module load would run during
 * `next build`, and the Lab tool must build fine on a machine with no database
 * configured.
 */
export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : null;
}

export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();

  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Copy .env.example to .env.local and add your Neon connection string.",
    );
  }

  return url;
}

/** True when the tool has everything it needs to talk to Postgres. */
export function isDatabaseConfigured(): boolean {
  return getDatabaseUrl() !== null;
}

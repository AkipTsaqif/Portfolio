import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JoinRoomForm } from "@/features/lab/daily-questions/components/join-room-form";
import { normalizeRoomCode } from "@/features/lab/daily-questions/code";
import { isDatabaseConfigured } from "@/lib/db/env";
import { findRoomByCode } from "@/features/lab/daily-questions/room";
import { getSession } from "@/features/lab/daily-questions/session";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/** A secret in a URL, so it must never be indexed. */
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/daily-questions/join/[code]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).dailyQuestions;
  return {
    title: t.joinRoom.title,
    description: t.joinRoom.description,
    robots: { index: false, follow: false },
  };
}

/**
 * Where an invite link lands.
 *
 * The code is validated here so a bad link says so immediately, but the actual
 * join is a Server Action — a Server Component render is not allowed to set the
 * device cookie.
 */
export default async function JoinPage({
  params,
}: PageProps<"/[locale]/lab/daily-questions/join/[code]">) {
  const { locale, code: rawCode } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions;

  const session = await getSession();
  if (session) redirect(localizedPath(locale, "/lab/daily-questions/room"));

  const code = normalizeRoomCode(rawCode);
  const room =
    isDatabaseConfigured() && code.length >= 8
      ? await findRoomByCode(code).catch(() => null)
      : null;

  return (
    <div className="shell page-wrap dq-page dq-page-narrow">
      <Link
        className="back-link"
        href={localizedPath(locale, "/lab/daily-questions")}
      >
        ← {t.metaTitle}
      </Link>

      <header className="page-intro dq-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.joinRoom.title}</h1>
        <div className="dq-intro-copy">
          {room ? (
            <p>
              {room.name ? `${room.name} — ` : ""}
              {t.joinRoom.description}
            </p>
          ) : (
            <p>{t.joinRoom.description}</p>
          )}
        </div>
      </header>

      <div className="dq-gate dq-gate-single">
        <section className="dq-gate-panel">
          <JoinRoomForm code={code} unknownCode={room === null} />
        </section>
      </div>
    </div>
  );
}

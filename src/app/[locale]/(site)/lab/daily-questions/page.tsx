import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateRoomForm } from "@/features/lab/daily-questions/components/create-room-form";
import { JoinRoomForm } from "@/features/lab/daily-questions/components/join-room-form";
import { hasDatabase, hasGateway } from "@/features/lab/daily-questions/env";
import { formatRoomCode } from "@/features/lab/daily-questions/code";
import { getSession } from "@/features/lab/daily-questions/session";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/daily-questions">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).dailyQuestions;
  return { title: t.metaTitle, description: t.metaDescription };
}

/**
 * The front door.
 *
 * If this device already belongs to a room it gets a way straight back in;
 * otherwise it gets the two ways to start: create, or join with a code.
 */
export default async function DailyQuestionsPage({
  params,
}: PageProps<"/[locale]/lab/daily-questions">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions;
  const session = await getSession();
  const databaseReady = hasDatabase();
  const gatewayReady = hasGateway();

  const steps = [
    { title: t.step1Title, text: t.step1Text },
    { title: t.step2Title, text: t.step2Text },
    { title: t.step3Title, text: t.step3Text },
  ];

  return (
    <div className="shell page-wrap dq-page">
      <Link className="back-link" href={localizedPath(locale, "/lab")}>
        ← {dictionary.common.backToLab}
      </Link>

      <header className="page-intro dq-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <div className="dq-intro-copy">
          <p>{t.description}</p>
          <p className="dq-privacy-note">
            <span aria-hidden="true">●</span> {t.privacyNote}
          </p>
        </div>
      </header>

      {!databaseReady ? (
        <p className="dq-error dq-config-warning" role="alert">
          {t.errors.notConfigured}
        </p>
      ) : null}

      {/* The tool still works without the gateway: the day falls back to the
          hand-checked standby bank. Say so rather than implying it is broken. */}
      {databaseReady && !gatewayReady ? (
        <p className="dq-notice dq-config-warning" role="status">
          {t.room.sourceFallback}
        </p>
      ) : null}

      {session ? (
        <section className="dq-enter">
          <p className="eyebrow">{t.room.metaTitle}</p>
          <h2>{session.room.name ?? formatRoomCode(session.room.code)}</h2>
          <p className="dq-enter-name">{session.member.display_name}</p>
          <Link
            className="dq-button dq-button-solid"
            href={localizedPath(locale, "/lab/daily-questions/room")}
          >
            {t.goToRoom}
          </Link>
        </section>
      ) : (
        <div className="dq-gate">
          <section className="dq-gate-panel dq-gate-start">
            <h2>{t.createRoom.title}</h2>
            <p>{t.createRoom.description}</p>
            <CreateRoomForm />
          </section>

          <section className="dq-gate-panel">
            <h2>{t.joinRoom.title}</h2>
            <p>{t.joinRoom.description}</p>
            <JoinRoomForm code="" unknownCode={false} />
          </section>
        </div>
      )}

      <section className="dq-how" aria-label={t.howEyebrow}>
        <header className="section-heading">
          <p className="eyebrow">{t.howEyebrow}</p>
          <h2>{t.howTitle}</h2>
        </header>
        <ol className="dq-how-list">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span>0{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <nav className="dq-public-links">
        <Link href={localizedPath(locale, "/lab/daily-questions/today")}>
          {t.today.metaTitle} →
        </Link>
        <Link href={localizedPath(locale, "/lab/daily-questions/archive")}>
          {t.archive.metaTitle} →
        </Link>
        <Link href={localizedPath(locale, "/lab/daily-questions/status")}>
          {t.status.metaTitle} →
        </Link>
      </nav>
    </div>
  );
}

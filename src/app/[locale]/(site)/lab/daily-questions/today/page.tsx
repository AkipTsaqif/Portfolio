import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { QuestionCard } from "@/features/lab/daily-questions/components/question-card";
import { isDatabaseConfigured } from "@/lib/db/env";
import { toDailyQuestion } from "@/features/lab/daily-questions/view";
import { resolveDailyQuestion } from "@/features/lab/daily-questions/questions";
import { scheduleNextDayPrewarm } from "@/features/lab/daily-questions/prewarm";
import { notifyQuestionReady } from "@/features/lab/daily-questions/push";
import { siteUrl } from "@/features/lab/daily-questions/urls";
import {
  resolveQuestionKind,
  utcToday,
} from "@/features/lab/daily-questions/utc-day";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/**
 * The public question of the day.
 *
 * `force-dynamic` on purpose: with a build-time render, `next build` would need
 * a reachable database and would happily bake a stale question into the page.
 * Every database read is wrapped, so an outage degrades to a message rather than
 * a failed build or a 500.
 */
export const dynamic = "force-dynamic";

/**
 * Generation takes 14-21s against the live gateway, and the retry budget allows up
 * to 45s. Vercel's default is 300s with Fluid Compute (the default for new
 * projects), so this is normally redundant — but a project created before Fluid
 * Compute became the default still has the old 10s Hobby ceiling, where generation
 * would time out on every attempt and serve the standby question forever, with
 * nothing in the UI to say why. Setting it explicitly makes the requirement part of
 * the code rather than a property of the project.
 *
 * A page-level value also sets the timeout for Server Actions invoked from that
 * page; see the room route for the one that matters there.
 */
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/daily-questions/today">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).dailyQuestions;
  return { title: t.today.metaTitle, description: t.today.metaDescription };
}

export default async function TodayPage({
  params,
}: PageProps<"/[locale]/lab/daily-questions/today">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions;
  const today = utcToday();

  // The public page shows the weekly-rhythm question, which is what a room with
  // the default setting sees.
  const kind = resolveQuestionKind("mixed", today);
  const question = isDatabaseConfigured()
    ? await resolveDailyQuestion(kind, today).catch(() => null)
    : null;

  const view = toDailyQuestion(question, locale);

  // Built while this response is already on its way out, so the next UTC day opens
  // without anyone waiting on generation.
  scheduleNextDayPrewarm();

  // The public page can be the first thing anyone opens on a given day, so it carries the
  // nudge too — gated inside notifyQuestionReady to today, and to a single send.
  after(async () => {
    await notifyQuestionReady({ kind, date: today, siteUrl: siteUrl() });
  });

  return (
    <div className="shell page-wrap dq-page dq-page-narrow">
      <Link
        className="back-link"
        href={localizedPath(locale, "/lab/daily-questions")}
      >
        ← {t.metaTitle}
      </Link>

      <header className="page-intro dq-intro">
        <p className="eyebrow">{t.today.eyebrow}</p>
        <h1>{t.today.title}</h1>
        <div className="dq-intro-copy">
          <p>{t.today.description}</p>
        </div>
      </header>

      {view ? (
        <QuestionCard copy={t} heading={t.today.eyebrow} question={view} />
      ) : (
        <p className="dq-note dq-missed">{t.today.empty}</p>
      )}

      <nav className="dq-public-links">
        <Link href={localizedPath(locale, "/lab/daily-questions/archive")}>
          {t.archive.metaTitle} →
        </Link>
        <Link href={localizedPath(locale, "/lab/daily-questions")}>
          {t.archive.startRoom} →
        </Link>
      </nav>
    </div>
  );
}

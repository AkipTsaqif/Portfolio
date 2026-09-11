import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseConfigured } from "@/lib/db/env";
import { QuestionCard } from "@/features/lab/daily-questions/components/question-card";
import { readDailyQuestion } from "@/features/lab/daily-questions/questions";
import {
  formatUtcDate,
  isDateString,
  resolveQuestionKind,
  utcToday,
} from "@/features/lab/daily-questions/utc-day";
import { toDailyQuestion } from "@/features/lab/daily-questions/view";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/daily-questions/archive/[date]">): Promise<Metadata> {
  const { locale, date } = await params;
  if (!isLocale(locale) || !isDateString(date)) return {};
  const t = (await getDictionary(locale)).dailyQuestions;
  const label = formatUtcDate(date, locale);

  return {
    title: t.archive.dayTitle.replace("{date}", label),
    description: t.archive.metaDescription,
  };
}

/**
 * One archived day: the question, and on knowledge days the answer.
 *
 * Read-only and never generates — an archive page must not be able to spend a
 * generation on a date nobody was live for.
 */
export default async function PublicDayPage({
  params,
}: PageProps<"/[locale]/lab/daily-questions/archive/[date]">) {
  const { locale, date } = await params;
  if (!isLocale(locale)) notFound();
  if (!isDateString(date) || date > utcToday()) notFound();

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions;

  const preferredKind = resolveQuestionKind("mixed", date);
  const otherKind = preferredKind === "knowledge" ? "reflective" : "knowledge";

  // Preferred kind first; if a knowledge-only or open-ended-only room was the
  // only one live that day, its variant is still reachable rather than a 404.
  const question = isDatabaseConfigured()
    ? (toDailyQuestion(
        await readDailyQuestion(preferredKind, date).catch(() => null),
        locale,
      ) ??
      toDailyQuestion(
        await readDailyQuestion(otherKind, date).catch(() => null),
        locale,
      ))
    : null;

  if (!question) notFound();

  return (
    <div className="shell page-wrap dq-page dq-page-narrow">
      <Link
        className="back-link"
        href={localizedPath(locale, "/lab/daily-questions/archive")}
      >
        ← {t.archive.backToArchive}
      </Link>

      <header className="page-intro dq-intro">
        <p className="eyebrow">{t.archive.eyebrow}</p>
        <h1>{formatUtcDate(date, locale)}</h1>
      </header>

      <QuestionCard
        copy={t}
        heading={formatUtcDate(date, locale)}
        question={question}
      />

      {question.answer ? (
        <aside className="dq-key">
          <p className="eyebrow">{t.room.answerKey}</p>
          <p>{question.answer}</p>
        </aside>
      ) : null}

      <p className="dq-note">{t.archive.description}</p>

      <nav className="dq-public-links">
        <Link href={localizedPath(locale, "/lab/daily-questions/archive")}>
          {t.archive.backToArchive} →
        </Link>
        <Link href={localizedPath(locale, "/lab/daily-questions")}>
          {t.archive.startRoom} →
        </Link>
      </nav>
    </div>
  );
}

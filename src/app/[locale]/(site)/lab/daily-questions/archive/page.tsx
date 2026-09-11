import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDatabaseConfigured } from "@/lib/db/env";
import { listRecentQuestions } from "@/features/lab/daily-questions/questions";
import { formatUtcDate } from "@/features/lab/daily-questions/utc-day";
import { publicArchive } from "@/features/lab/daily-questions/view";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/** Same reasoning as `/today`: never let a build or an outage break this page. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/daily-questions/archive">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).dailyQuestions;
  return { title: t.archive.metaTitle, description: t.archive.metaDescription };
}

/**
 * Every question the tool has asked, newest first.
 *
 * This is the public half of the ritual and genuine content, so it is indexed:
 * one page per day, each with the question and — on knowledge days — the
 * verified answer.
 */
export default async function PublicArchivePage({
  params,
}: PageProps<"/[locale]/lab/daily-questions/archive">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions;

  const rows = isDatabaseConfigured()
    ? await listRecentQuestions(120).catch(() => [])
    : [];
  const questions = publicArchive(rows, locale);

  return (
    <div className="shell page-wrap dq-page">
      <Link
        className="back-link"
        href={localizedPath(locale, "/lab/daily-questions")}
      >
        ← {t.metaTitle}
      </Link>

      <header className="page-intro dq-intro">
        <p className="eyebrow">{t.archive.eyebrow}</p>
        <h1>{t.archive.title}</h1>
        <div className="dq-intro-copy">
          <p>{t.archive.description}</p>
        </div>
      </header>

      {questions.length === 0 ? (
        <p className="dq-note dq-missed">{t.archive.empty}</p>
      ) : (
        <ol className="dq-archive-list">
          {questions.map((question) => (
            <li key={question.date}>
              <Link
                href={localizedPath(
                  locale,
                  `/lab/daily-questions/archive/${question.date}`,
                )}
              >
                <span className="dq-archive-date">
                  {formatUtcDate(question.date, locale)}
                </span>
                <span className="dq-archive-kind">
                  {question.kind === "knowledge"
                    ? t.archive.knowledge
                    : t.archive.reflective}
                </span>
                <span className="dq-archive-prompt">{question.prompt}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

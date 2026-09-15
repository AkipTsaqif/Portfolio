import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHealthReport } from "@/features/lab/daily-questions/health";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/**
 * Live status for the tool, on a public page.
 *
 * Public because the failure it exists to catch is invisible: the tool keeps
 * answering, it just quietly serves standby questions. `force-dynamic` because a cached
 * status page reports yesterday's health.
 *
 * `noindex` and absent from the sitemap on purpose — it is an operational page, and the
 * thing it reports is the thing you would least like indexed.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/daily-questions/status">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).dailyQuestions.status;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    robots: { index: false, follow: false },
  };
}

export default async function DailyQuestionsStatusPage({
  params,
}: PageProps<"/[locale]/lab/daily-questions/status">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions.status;

  // never throws: every probe inside is individually guarded, because a status page is
  // most needed exactly when things are broken
  const report = await getHealthReport();

  return (
    <div className="shell page-wrap dq-page dq-page-narrow">
      <Link
        className="back-link"
        href={localizedPath(locale, "/lab/daily-questions")}
      >
        ← {dictionary.dailyQuestions.metaTitle}
      </Link>

      <header className="page-intro dq-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <div className="dq-intro-copy">
          <p>{t.description}</p>
        </div>
      </header>

      <section className="dq-status" aria-live="polite">
        <p className="dq-status-overall">
          <span
            aria-hidden="true"
            className={`status-dot dq-status-dot-${report.state}`}
          />
          {t.overall[report.state]}
        </p>
        <p className="dq-status-day">
          {t.dayLabel}: <strong>{report.date}</strong>
        </p>
      </section>

      <dl className="dq-status-list">
        {report.checks.map((check) => (
          <div className="dq-status-row" key={check.id}>
            <dt>
              <span
                aria-hidden="true"
                className={`status-dot dq-status-dot-${check.state}`}
              />
              {t.checks[check.id]}
            </dt>
            <dd>
              {t.detail[check.detail]}
              {check.latencyMs === undefined ? null : (
                <span className="dq-status-latency">
                  {t.latencyLabel} {check.latencyMs}ms
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="dq-note dq-status-note">{t.note}</p>
    </div>
  );
}

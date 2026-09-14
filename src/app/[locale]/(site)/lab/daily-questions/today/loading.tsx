"use client";

import { useI18n } from "@/i18n/client-context";

/**
 * The first visitor of each UTC day is the one who pays for generation, which
 * takes ~18s against the live gateway. Without this the browser shows nothing at
 * all for that whole time; with it the shell arrives in about a second and only
 * the question is pending.
 *
 * A client component on purpose: `loading.tsx` is handed no route params, but the
 * I18nProvider sits above it in `[locale]/layout.tsx`, so the dictionary is
 * available.
 */
export default function TodayLoading() {
  const { dictionary } = useI18n();
  const t = dictionary.dailyQuestions;

  return (
    <div className="shell page-wrap dq-page dq-page-narrow" aria-busy="true">
      <header className="page-intro dq-intro">
        <p className="eyebrow">{t.today.eyebrow}</p>
        <h1>{t.today.title}</h1>
        <div className="dq-intro-copy">
          <p>{t.today.description}</p>
        </div>
      </header>

      <article className="dq-question dq-question-pending">
        <div className="dq-chips">
          <div className="dq-skeleton dq-skeleton-chip" />
        </div>
        <div className="dq-skeleton dq-skeleton-prompt" />
        <div className="dq-skeleton dq-skeleton-prompt dq-skeleton-short" />
        <p className="dq-note" role="status">
          <span aria-hidden="true" className="dq-waiting-dot" /> {t.preparing}
        </p>
      </article>
    </div>
  );
}

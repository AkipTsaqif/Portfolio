"use client";

import { useI18n } from "@/i18n/client-context";

/**
 * Same reason as the public `/today` route: the first request of a UTC day blocks
 * on generation, so the shell should land immediately rather than a blank page.
 *
 * Scoped to this route group on purpose — the sibling calendar and day routes
 * never generate, so they should not show a "preparing today's question" state.
 */
export default function RoomLoading() {
  const { dictionary } = useI18n();
  const t = dictionary.dailyQuestions;

  return (
    <div className="shell page-wrap dq-page dq-room" aria-busy="true">
      <header className="dq-room-head">
        <div>
          <p className="eyebrow">{t.room.metaTitle}</p>
          <div className="dq-skeleton dq-skeleton-title" />
        </div>
      </header>

      <article className="dq-question dq-question-pending">
        <p className="eyebrow">{t.room.todaysQuestion}</p>
        <div className="dq-skeleton dq-skeleton-prompt" />
        <div className="dq-skeleton dq-skeleton-prompt dq-skeleton-short" />
        <p className="dq-note" role="status">
          <span aria-hidden="true" className="dq-waiting-dot" /> {t.preparing}
        </p>
      </article>
    </div>
  );
}

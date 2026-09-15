import type { Copy } from "../copy";
import type { RoomDayView } from "../types";
import { initialActionState } from "../action-state";
import { flagQuestionAction } from "../actions";
import { AnswerCard, AnswerKey } from "./answer-card";
import { AnswerForm } from "./answer-form";
import { ConfirmSubmit } from "./confirm-submit";
import { QuestionCard, QuestionUnavailable } from "./question-card";

/**
 * A whole day: the question, the answer box or the answers, and the key.
 *
 * Shared by the room's today view and by a single archived day, because the
 * reveal rules are identical in both.
 */
export function DayView({
  copy,
  day,
  locale,
  heading,
}: {
  copy: Copy;
  day: RoomDayView;
  locale: string;
  heading: string;
}) {
  const t = copy.room;

  if (!day.question) {
    return <QuestionUnavailable copy={copy} />;
  }

  return (
    <>
      <QuestionCard copy={copy} heading={heading} question={day.question} />

      {/*
       * The one unmitigated risk in a design that publishes model-written questions to an
       * indexed page is that nobody checks them. This is the check.
       */}
      {day.questionFlagged ? (
        <p className="dq-note dq-flag-state">{t.questionFlagged}</p>
      ) : (
        <details className="dq-flag">
          <summary>{t.flagQuestion}</summary>
          <form action={flagQuestionAction}>
            <input name="locale" type="hidden" value={locale} />
            <input name="date" type="hidden" value={day.date} />
            <input name="kind" type="hidden" value={day.kind} />
            <label className="dq-label" htmlFor="dq-flag-note">
              {t.flagNoteLabel}
            </label>
            <textarea
              className="dq-textarea dq-textarea-short"
              id="dq-flag-note"
              maxLength={280}
              name="note"
              placeholder={t.flagNotePlaceholder}
              rows={3}
            />
            <ConfirmSubmit label={t.flagSubmit} message={t.flagConfirm} />
          </form>
        </details>
      )}

      {!day.meAnswered && day.isToday ? (
        <AnswerForm date={day.date} kind={day.kind} />
      ) : null}

      {!day.meAnswered && !day.isToday ? (
        <p className="dq-note dq-missed" role="status">
          {t.missedDay}
        </p>
      ) : null}

      {day.meAnswered ? (
        <section className="dq-answers" aria-label={t.answers}>
          <p className="eyebrow">{t.answers}</p>

          {day.answerKey ? (
            <AnswerKey answer={day.answerKey} copy={copy} />
          ) : null}

          <div className="dq-answer-list">
            {day.entries.map((entry) => (
              <AnswerCard
                copy={copy}
                date={day.date}
                entry={entry}
                key={entry.memberId}
                kind={day.kind}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

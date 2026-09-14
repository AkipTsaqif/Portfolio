import type { Copy } from "../copy";
import type { RoomDayView } from "../types";
import { AnswerCard, AnswerKey } from "./answer-card";
import { AnswerForm } from "./answer-form";
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

import type { Copy } from "../copy";
import type { DailyQuestion } from "../types";

/**
 * The question itself. Presentational and server-rendered — no interactivity,
 * and nothing here depends on whether the reader has answered.
 */
export function QuestionCard({
  copy,
  question,
  heading,
}: {
  copy: Copy;
  question: DailyQuestion;
  heading: string;
}) {
  const t = copy.room;

  return (
    <article className="dq-question">
      <header className="dq-question-head">
        <p className="eyebrow">{heading}</p>
        <div className="dq-chips">
          <span className="dq-chip dq-chip-kind">
            {question.kind === "knowledge" ? t.kindKnowledge : t.kindReflective}
          </span>
          {question.category ? (
            <span className="dq-chip">{question.category}</span>
          ) : null}
          {question.difficulty ? (
            <span className="dq-chip dq-chip-difficulty">
              {t.difficulty[question.difficulty]}
            </span>
          ) : null}
        </div>
      </header>

      <p className="dq-prompt">{question.prompt}</p>

      {question.source === "fallback" ? (
        <p className="dq-note">{t.sourceFallback}</p>
      ) : null}
    </article>
  );
}

/** Shown when generation failed and the standby question could not be recorded. */
export function QuestionUnavailable({ copy }: { copy: Copy }) {
  const t = copy.room;

  return (
    <article className="dq-question dq-question-empty">
      <p className="eyebrow">{t.todaysQuestion}</p>
      <p className="dq-prompt">{t.noQuestion}</p>
      <p className="dq-note">{t.noQuestionHelp}</p>
    </article>
  );
}

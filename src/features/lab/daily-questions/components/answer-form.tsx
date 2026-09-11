"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/i18n/client-context";
import { initialActionState } from "../action-state";
import { submitAnswerAction } from "../actions";
import { MAX_ANSWER_LENGTH, type QuestionKind } from "../types";

/**
 * The one place you commit. There is no edit: submitting locks the answer and
 * unlocks everyone else's, which is the whole mechanic.
 */
export function AnswerForm({
  date,
  kind,
}: {
  date: string;
  kind: QuestionKind;
}) {
  const { locale, dictionary } = useI18n();
  const t = dictionary.dailyQuestions.room;
  const [state, formAction, pending] = useActionState(
    submitAnswerAction,
    initialActionState,
  );
  const [length, setLength] = useState(0);

  return (
    <form action={formAction} className="dq-answer-form">
      <input name="locale" type="hidden" value={locale} />
      <input name="date" type="hidden" value={date} />
      <input name="kind" type="hidden" value={kind} />

      <label className="dq-label" htmlFor="dq-answer">
        {t.yourAnswer}
      </label>

      <textarea
        className="dq-textarea"
        id="dq-answer"
        maxLength={MAX_ANSWER_LENGTH}
        name="body"
        onChange={(event) => setLength(event.target.value.length)}
        placeholder={t.answerPlaceholder}
        required
        rows={6}
      />

      <div className="dq-answer-actions">
        <p className="dq-counter">
          {length} / {MAX_ANSWER_LENGTH} {t.answerCounter}
        </p>
        <button
          className="dq-button dq-button-solid"
          disabled={pending}
          type="submit"
        >
          {pending ? t.submitting : t.submit}
        </button>
      </div>

      {state.error ? (
        <p className="dq-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

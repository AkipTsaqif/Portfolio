import { retractAnswerAction, toggleReactionAction } from "../actions";
import type { Copy } from "../copy";
import type { DayAnswerView, QuestionKind } from "../types";
import { REACTION_EMOJIS } from "../types";
import { ConfirmSubmit } from "./confirm-submit";

/**
 * One person's slot for the day.
 *
 * When `body` is null the server never sent the text at all, so there is nothing
 * to hide here — this renders "waiting" because there is genuinely nothing else
 * to render.
 */
export function AnswerCard({
  copy,
  entry,
  date,
  kind,
  locale,
}: {
  copy: Copy;
  entry: DayAnswerView;
  date: string;
  kind: QuestionKind;
  locale: string;
}) {
  const t = copy.room;

  return (
    <article
      className={`dq-answer${entry.isMe ? "dq-answer-mine" : ""}${
        entry.body ? "" : "dq-answer-locked"
      }`}
    >
      <header className="dq-answer-head">
        <h3>{entry.displayName}</h3>
        {entry.isMe ? <span className="dq-chip">{t.ownAnswerNote}</span> : null}
      </header>

      {entry.body ? (
        <p className="dq-answer-body">{entry.body}</p>
      ) : (
        <p className="dq-waiting">
          {t.waitingFor.replace("{name}", entry.displayName)}
          <span aria-hidden="true" className="dq-waiting-dot" />
        </p>
      )}

      {entry.body && entry.isMe ? (
        <details className="dq-retract">
          <summary>{t.retract}</summary>
          <form action={retractAnswerAction}>
            <input name="locale" type="hidden" value={locale} />
            <input name="date" type="hidden" value={date} />
            <input name="kind" type="hidden" value={kind} />
            <ConfirmSubmit label={t.retract} message={t.retractConfirm} />
          </form>
        </details>
      ) : null}

      {entry.body && !entry.isMe ? (
        <ReactionBar copy={copy} entry={entry} locale={locale} />
      ) : null}

      {entry.body && entry.isMe && entry.reactions.length > 0 ? (
        <div className="dq-reactions dq-reactions-received">
          <p className="eyebrow">{t.theirReactions}</p>
          <ul>
            {entry.reactions.map((reaction) => (
              <li
                className="dq-reaction dq-reaction-static"
                key={reaction.emoji}
              >
                <span aria-hidden="true">{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

/** The answer key, revealed only to someone who has already answered. */
export function AnswerKey({ copy, answer }: { copy: Copy; answer: string }) {
  return (
    <aside className="dq-key">
      <p className="eyebrow">{copy.room.answerKey}</p>
      <p>{answer}</p>
    </aside>
  );
}

function ReactionBar({
  copy,
  entry,
  locale,
}: {
  copy: Copy;
  entry: DayAnswerView;
  locale: string;
}) {
  const t = copy.room;

  return (
    <div className="dq-reactions" aria-label={t.reactToAnswer}>
      {REACTION_EMOJIS.map((emoji) => {
        const existing = entry.reactions.find((item) => item.emoji === emoji);
        const count = existing?.count ?? 0;
        const mine = existing?.mine ?? false;

        return (
          <form
            action={toggleReactionAction}
            className="dq-reaction-form"
            key={emoji}
          >
            <input name="locale" type="hidden" value={locale} />
            <input name="answerId" type="hidden" value={entry.answerId ?? ""} />
            <input name="emoji" type="hidden" value={emoji} />
            <button
              aria-pressed={mine}
              className={`dq-reaction${mine ? "dq-reaction-mine" : ""}${
                count === 0 ? "dq-reaction-empty" : ""
              }`}
              title={mine ? t.removeReaction : t.reactToAnswer}
              type="submit"
            >
              <span aria-hidden="true">{emoji}</span>
              {count > 0 ? <span>{count}</span> : null}
            </button>
          </form>
        );
      })}
    </div>
  );
}

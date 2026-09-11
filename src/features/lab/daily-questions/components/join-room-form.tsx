"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/client-context";
import { initialActionState } from "../action-state";
import { joinRoomAction } from "../actions";
import { MAX_DISPLAY_NAME_LENGTH } from "../types";

/**
 * The receiving end of an invite link.
 *
 * The code is prefilled when arriving from `/join/<code>`; typing it by hand
 * works too, and either way this is a form submit rather than a bare GET,
 * because setting the device cookie is only legal from a Server Action.
 */
export function JoinRoomForm({
  code,
  unknownCode,
}: {
  code: string;
  unknownCode: boolean;
}) {
  const { locale, dictionary } = useI18n();
  const t = dictionary.dailyQuestions;
  const [state, formAction, pending] = useActionState(
    joinRoomAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="dq-form">
      <input name="locale" type="hidden" value={locale} />

      <div className="dq-field">
        <label className="dq-label" htmlFor="dq-join-code">
          {t.joinRoom.codeLabel}
        </label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          className="dq-input dq-input-code"
          defaultValue={code}
          id="dq-join-code"
          name="code"
          placeholder={t.joinRoom.codePlaceholder}
          required
          spellCheck={false}
          type="text"
        />
        <p className="dq-note">{t.codeHint}</p>
      </div>

      <div className="dq-field">
        <label className="dq-label" htmlFor="dq-join-name">
          {t.joinRoom.nameLabel}
        </label>
        <input
          autoComplete="nickname"
          className="dq-input"
          id="dq-join-name"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          name="displayName"
          placeholder={t.joinRoom.namePlaceholder}
          required
          type="text"
        />
      </div>

      <button
        className="dq-button dq-button-solid"
        disabled={pending}
        type="submit"
      >
        {pending ? t.joinRoom.submitting : t.joinRoom.submit}
      </button>

      {unknownCode && !state.error ? (
        <p className="dq-error" role="alert">
          {t.errors.roomNotFound}
        </p>
      ) : null}

      {state.error ? (
        <p className="dq-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

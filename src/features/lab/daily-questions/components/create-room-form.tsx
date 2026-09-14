"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/client-context";
import { initialActionState } from "../action-state";
import { createRoomAction } from "../actions";
import { MAX_DISPLAY_NAME_LENGTH, MAX_ROOM_NAME_LENGTH } from "../types";

/**
 * Start a room: a name, an optional room title, and the question style.
 *
 * The style is chosen here because it decides which of the two daily questions
 * this room looks at, and it can be changed later from room settings.
 */
export function CreateRoomForm() {
  const { locale, dictionary } = useI18n();
  const t = dictionary.dailyQuestions;
  const [state, formAction, pending] = useActionState(
    createRoomAction,
    initialActionState,
  );

  return (
    <form action={formAction} className="dq-form">
      <input name="locale" type="hidden" value={locale} />

      <div className="dq-field">
        <label className="dq-label" htmlFor="dq-create-name">
          {t.createRoom.nameLabel}
        </label>
        <input
          autoComplete="nickname"
          className="dq-input"
          id="dq-create-name"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          name="displayName"
          placeholder={t.createRoom.namePlaceholder}
          required
          type="text"
        />
      </div>

      <div className="dq-field">
        <label className="dq-label" htmlFor="dq-create-room">
          {t.createRoom.roomNameLabel}
        </label>
        <input
          className="dq-input"
          id="dq-create-room"
          maxLength={MAX_ROOM_NAME_LENGTH}
          name="roomName"
          placeholder={t.createRoom.roomNamePlaceholder}
          type="text"
        />
      </div>

      <fieldset className="dq-fieldset">
        <legend className="dq-label">{t.createRoom.modeLabel}</legend>
        <div className="dq-radio-list">
          {(["mixed", "knowledge", "reflective"] as const).map((mode) => (
            <label className="dq-radio" key={mode}>
              <input
                defaultChecked={mode === "mixed"}
                name="questionMode"
                type="radio"
                value={mode}
              />
              <span className="dq-radio-body">
                <strong>{t.mode[mode]}</strong>
                <span>{t.mode[`${mode}Hint`]}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="dq-note">{t.createRoom.modeHelp}</p>
      </fieldset>

      <button
        className="dq-button dq-button-solid"
        disabled={pending}
        type="submit"
      >
        {pending ? t.createRoom.submitting : t.createRoom.submit}
      </button>

      {state.error ? (
        <p className="dq-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

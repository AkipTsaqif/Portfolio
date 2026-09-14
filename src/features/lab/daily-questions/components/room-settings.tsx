"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/client-context";
import { initialActionState } from "../action-state";
import {
  deleteRoomAction,
  leaveRoomAction,
  setQuestionModeAction,
} from "../actions";
import type { RoomMode } from "../types";
import { ConfirmSubmit } from "./confirm-submit";

/**
 * Room settings, including the question-style toggle.
 *
 * The style is read live, so flipping it mid-day swaps today's question as well.
 * That is stated plainly rather than hidden behind a dialog nobody reads.
 */
export function RoomSettings({
  mode,
  formattedCode,
}: {
  mode: RoomMode;
  formattedCode: string;
}) {
  const { locale, dictionary } = useI18n();
  const t = dictionary.dailyQuestions;
  const [modeState, modeAction, modePending] = useActionState(
    setQuestionModeAction,
    initialActionState,
  );
  const [leaveState, leaveAction] = useActionState(
    leaveRoomAction,
    initialActionState,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteRoomAction,
    initialActionState,
  );

  return (
    <section className="dq-settings">
      <header className="dq-settings-head">
        <p className="eyebrow">{t.room.settings}</p>
      </header>

      <form action={modeAction} className="dq-form dq-form-inline">
        <input name="locale" type="hidden" value={locale} />
        <div className="dq-field">
          <label className="dq-label" htmlFor="dq-room-mode">
            {t.createRoom.modeLabel}
          </label>
          <select
            className="dq-input"
            defaultValue={mode}
            id="dq-room-mode"
            name="mode"
          >
            {(["mixed", "knowledge", "reflective"] as const).map((value) => (
              <option key={value} value={value}>
                {t.mode[value]}
              </option>
            ))}
          </select>
        </div>
        <button className="dq-button" disabled={modePending} type="submit">
          {t.room.settings}
        </button>
        <p className="dq-note dq-span">{t.room.settingsHelp}</p>
        {modeState.error ? (
          <p className="dq-error dq-span" role="alert">
            {modeState.error}
          </p>
        ) : modeState.notice ? (
          <p className="dq-notice dq-span" role="status">
            {modeState.notice}
          </p>
        ) : null}
      </form>

      <div className="dq-danger">
        <form action={leaveAction}>
          <input name="locale" type="hidden" value={locale} />
          <ConfirmSubmit label={t.room.leave} message={t.room.leaveConfirm} />
        </form>

        <form action={deleteAction}>
          <input name="locale" type="hidden" value={locale} />
          <ConfirmSubmit
            className="dq-button dq-button-danger"
            label={t.room.deleteRoom}
            message={t.room.deleteRoomConfirm}
          />
        </form>
      </div>

      {(leaveState.error ?? deleteState.error) ? (
        <p className="dq-error" role="alert">
          {leaveState.error ?? deleteState.error}
        </p>
      ) : null}

      <p className="dq-code-line">
        {t.room.code}: <strong>{formattedCode}</strong>
      </p>
    </section>
  );
}

/**
 * Shared result shape for every form in the tool.
 *
 * Actions return messages that are already localised — the action runs on the
 * server and can load the dictionary itself, so error codes never have to be
 * mapped in the browser.
 *
 * Lives outside `actions.ts` because a `"use server"` module may only export
 * async functions.
 */
export type ActionState = {
  error: string | null;
  notice: string | null;
  ok: boolean;
};

export const initialActionState: ActionState = {
  error: null,
  notice: null,
  ok: false,
};

export function actionError(message: string): ActionState {
  return { error: message, notice: null, ok: false };
}

export function actionNotice(message: string): ActionState {
  return { error: null, notice: message, ok: true };
}

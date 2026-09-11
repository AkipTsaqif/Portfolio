"use client";

/**
 * A submit button that asks first.
 *
 * Deliberately the only client-side behaviour a destructive form needs: with
 * JavaScript off the form still submits, just without the guard.
 */
export function ConfirmSubmit({
  label,
  message,
  className = "dq-button dq-button-quiet",
}: {
  label: string;
  message: string;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      type="submit"
    >
      {label}
    </button>
  );
}

"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client-context";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dictionary } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="shell not-found" role="alert">
      <p className="eyebrow">Error</p>
      <h1>{dictionary.errors.title}</h1>
      <p>{dictionary.errors.description}</p>
      <button
        className="button-link error-button"
        onClick={reset}
        type="button"
      >
        {dictionary.errors.retry} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

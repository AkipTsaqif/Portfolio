"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client-context";

/**
 * The invite link, shown in full because this is a private room and the whole
 * model is "send this to the other person".
 */
export function InviteLink({
  url,
  code,
  formattedCode,
}: {
  url: string;
  code: string;
  formattedCode: string;
}) {
  const { dictionary } = useI18n();
  const t = dictionary.dailyQuestions.room;
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <div className="dq-invite">
      <div className="dq-invite-body">
        <p className="eyebrow">{t.invite}</p>
        <p className="dq-invite-code">{formattedCode}</p>
        <p className="dq-invite-help">{t.inviteHelp}</p>
        <p className="dq-invite-url" data-code={code}>
          {url}
        </p>
      </div>
      <button
        className="dq-button dq-button-solid"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setStatus("copied");
          } catch {
            setStatus("failed");
          }
        }}
        type="button"
      >
        {status === "copied" ? t.copied : t.copyLink}
      </button>
      {status === "failed" ? (
        <p className="dq-note" role="alert">
          {t.copyFailed}
        </p>
      ) : null}
    </div>
  );
}

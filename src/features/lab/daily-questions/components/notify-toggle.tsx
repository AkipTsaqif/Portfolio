"use client";

import { useActionState, useEffect, useState } from "react";
import { useI18n } from "@/i18n/client-context";
import { initialActionState } from "../action-state";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
} from "../actions";

/**
 * Turns nudges on and off.
 *
 * Browser permission can only be requested from a user gesture, so this is a button and
 * never automatic — a page that asks for notifications on load is the behaviour that
 * trains people to click "Block" reflexively.
 *
 * Push has more ways to be unavailable than to work. Each is handled with its own
 * message rather than a generic failure, because they need different actions from the
 * reader: an iPhone user has to add the site to their Home Screen before push exists at
 * all, which is not something they would guess from "could not enable notifications".
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}

type Status =
  "checking" | "unsupported" | "blocked" | "off" | "on" | "working" | "failed";

export function NotifyToggle({
  vapidPublicKey,
  subscribedOnServer,
}: {
  vapidPublicKey: string | null;
  subscribedOnServer: boolean;
}) {
  const { locale, dictionary } = useI18n();
  const t = dictionary.dailyQuestions.notify;
  const [status, setStatus] = useState<Status>("checking");
  const [error, formAction, pending] = useActionState(
    savePushSubscriptionAction,
    initialActionState,
  );

  // Reconcile against the browser rather than trusting either side alone: the server may
  // have a row for a subscription the user has since revoked, and a browser may hold a
  // live subscription the server has never been told about (a failed save, a restored
  // profile).
  useEffect(() => {
    let cancelled = false;

    const inspect = async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !vapidPublicKey
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("blocked");
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.getRegistration("/sw.js");
        const existing = await registration?.pushManager.getSubscription();
        if (!cancelled) setStatus(existing ? "on" : "off");
      } catch {
        if (!cancelled) setStatus(subscribedOnServer ? "on" : "off");
      }
    };

    void inspect();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey, subscribedOnServer]);

  async function enable() {
    if (!vapidPublicKey) return;
    setStatus("working");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });

      const json = subscription.toJSON();
      const data = new FormData();
      data.set("locale", locale);
      data.set("endpoint", subscription.endpoint);
      data.set("p256dh", json.keys?.p256dh ?? "");
      data.set("auth", json.keys?.auth ?? "");
      data.set("userAgent", navigator.userAgent.slice(0, 200));
      formAction(data);

      setStatus("on");
    } catch {
      setStatus("failed");
    }
  }

  async function disable() {
    setStatus("working");

    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;

      await subscription?.unsubscribe();

      const data = new FormData();
      data.set("locale", locale);
      data.set("endpoint", endpoint ?? "");
      removePushSubscriptionAction(data);

      setStatus("off");
    } catch {
      setStatus("failed");
    }
  }

  const busy = status === "working" || pending;

  return (
    <section className="dq-notify">
      <p className="eyebrow">{t.title}</p>
      <p className="dq-note dq-notify-copy">{t.description}</p>

      {status === "checking" ? null : status === "unsupported" ? (
        <p className="dq-note">{t.unsupported}</p>
      ) : status === "blocked" ? (
        <p className="dq-note">{t.blocked}</p>
      ) : status === "on" ? (
        <div className="dq-notify-actions">
          <span className="dq-notify-state">{t.enabled}</span>
          <button
            className="dq-button dq-button-quiet"
            disabled={busy}
            onClick={() => void disable()}
            type="button"
          >
            {busy ? t.working : t.disable}
          </button>
        </div>
      ) : (
        <div className="dq-notify-actions">
          <button
            className="dq-button dq-button-quiet"
            disabled={busy}
            onClick={() => void enable()}
            type="button"
          >
            {busy ? t.working : t.enable}
          </button>
        </div>
      )}

      {status === "failed" || error.error ? (
        <p className="dq-error" role="alert">
          {t.failed}
        </p>
      ) : null}
    </section>
  );
}

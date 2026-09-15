/**
 * Service worker for web push.
 *
 * Served from `public/` at `/sw.js`, so it controls the whole origin rather than a locale
 * path. Two handlers only:
 *
 *   `push`               — shows the notification. Payload is JSON from `push.ts`, and by
 *                          design carries no question text: the push service in between
 *                          (Google's or Mozilla's) sees only "the question is ready".
 *   `notificationclick`  — focuses an existing tab if one is open, otherwise opens one.
 *                          Without this, tapping a notification does nothing on some
 *                          platforms, which reads as a broken nudge.
 *
 * Deliberately no `install`/`activate` handlers and no fetch caching: this is not a PWA
 * and has no offline story. A service worker that "helpfully" caches a dynamic,
 * session-gated app is a bug factory.
 */

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // a malformed payload should still produce something rather than nothing
    payload = {};
  }

  const title = payload.title || "Daily Questions";
  const body = payload.body || "Today's question is ready.";
  const url = payload.url || "/lab/daily-questions/room";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      // stable per-day tag: a duplicate sends replaces rather than stacks
      tag: "daily-questions",
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target =
    (event.notification.data && event.notification.data.url) ||
    "/lab/daily-questions/room";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (
            client.url.includes("/lab/daily-questions") &&
            "focus" in client
          ) {
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});

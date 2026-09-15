import type { MetadataRoute } from "next";

/**
 * Web app manifest.
 *
 * It exists for one reason: **on iOS, web push only works once the site has been added to
 * the Home Screen.** A manifest is what makes that produce a real app icon and a
 * standalone window rather than a bookmark that opens in Safari and receives nothing.
 *
 * `scope: "/"` because the room is a destination, not the whole site — a narrower scope
 * would drop someone out of standalone mode the moment they tapped through to the Lab or
 * the journal.
 *
 * Known gap: the only icon available is the site favicon. iOS prefers a 180px PNG
 * `apple-touch-icon`, so the home-screen icon will be generated rather than designed.
 * Worth replacing, but it does not affect whether nudges arrive.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daily Questions",
    short_name: "Questions",
    description:
      "One question a day, answered privately, then revealed to each other.",
    start_url: "/lab/daily-questions/room",
    scope: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#f4f1ea",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}

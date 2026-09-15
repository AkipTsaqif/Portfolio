"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

/**
 * The travel map.
 *
 * Three choices worth recording.
 *
 * **Plain Leaflet, driven imperatively, rather than `react-leaflet`.** The map is static —
 * markers, popups, one fit-to-bounds — and the wrapper adds a dependency plus a React-version
 * coupling for no behaviour this needs. The imperative version is also explicit about when
 * Leaflet is allowed to load.
 *
 * **Leaflet is imported inside the effect, not at the top.** It touches `window` the moment
 * it is evaluated, and client components are still server-rendered first. A static import
 * would crash the render; a dynamic one defers it to the browser, which is the only place it
 * can work.
 *
 * **Popups are built as DOM nodes, not HTML strings.** `bindPopup` accepts a string and will
 * happily parse it as markup. Content here comes from the CMS, which for this site is a
 * trusted single author — but "trusted today" is how injection bugs get written, and building
 * nodes costs nothing.
 *
 * Also: `circleMarker` rather than the default pin, because Leaflet's default icon URLs break
 * under bundlers unless you patch `L.Icon.Default` — and a circle is closer to the site's
 * editorial look than a teardrop anyway.
 */

export type MapDestination = {
  name: string;
  country: string;
  description: string | null;
  lat: number;
  lng: number;
};

/** Keyless, muted, and light enough to sit on `--paper` without fighting it. */
const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function DestinationMap({
  destinations,
  label,
}: {
  destinations: MapDestination[];
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      const container = containerRef.current;
      if (!container || mapRef.current) return;

      const leaflet = (await import("leaflet")).default;

      // the effect can be torn down while the import is in flight
      if (cancelled || !containerRef.current) return;

      const map = leaflet.map(container, {
        // never hijack the page's own scrolling; the map is something you choose to pan
        scrollWheelZoom: false,
        worldCopyJump: true,
      });
      mapRef.current = map;

      leaflet
        .tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          subdomains: "abcd",
          maxZoom: 19,
        })
        .addTo(map);

      const bounds = leaflet.latLngBounds([]);

      for (const destination of destinations) {
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = destination.name;
        popup.append(
          title,
          document.createElement("br"),
          document.createTextNode(destination.country),
        );

        if (destination.description) {
          popup.append(
            document.createElement("br"),
            document.createTextNode(destination.description),
          );
        }

        leaflet
          .circleMarker([destination.lat, destination.lng], {
            radius: 7,
            color: "var(--ink, #1f2925)",
            weight: 2,
            fillColor: "#d9ef57",
            fillOpacity: 1,
          })
          .addTo(map)
          .bindPopup(popup);

        bounds.extend([destination.lat, destination.lng]);
      }

      // One pin still deserves context, so zoom to it rather than leaving the world view.
      if (destinations.length === 1) {
        map.setView([destinations[0].lat, destinations[0].lng], 7);
      } else if (destinations.length > 1) {
        map.fitBounds(bounds.pad(0.25));
      }
    };

    void draw();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [destinations]);

  return (
    <div
      aria-label={label}
      className="travel-map"
      ref={containerRef}
      role="img"
    />
  );
}

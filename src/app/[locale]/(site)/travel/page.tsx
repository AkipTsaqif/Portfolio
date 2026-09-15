import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DestinationMap } from "@/components/travel/destination-map";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
import { getSanityDestinations } from "@/lib/sanity/fetch";

/**
 * The travel map.
 *
 * Reads the `destination` documents, which already carry a `geopoint` — no new schema. The
 * query filters to destinations that *have* coordinates, so this page is honest about being
 * content-dependent: with none entered it says so rather than rendering an empty world map.
 *
 * ISR rather than dynamic: the data changes when a place is added, which is rare, and the
 * revalidate tag is shared with the rest of the Sanity content.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/travel">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).travel;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function TravelPage({
  params,
}: PageProps<"/[locale]/travel">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = await getDictionary(locale);
  const t = dictionary.travel;

  const destinations = (await getSanityDestinations().catch(() => null)) ?? [];

  // Narrowed here rather than in the component, so the map only ever receives plottable
  // points and cannot be handed a lat/lng that might not exist.
  const plotted = destinations.flatMap((destination) =>
    destination.coordinates
      ? [
          {
            name: destination.name,
            country: destination.country,
            description: destination.description,
            lat: destination.coordinates.lat,
            lng: destination.coordinates.lng,
          },
        ]
      : [],
  );

  return (
    <div className="shell page-wrap travel-page">
      <header className="page-intro travel-intro">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <div className="travel-intro-copy">
          <p>{t.description}</p>
        </div>
      </header>

      {plotted.length === 0 ? (
        <p className="empty-content travel-empty">{t.empty}</p>
      ) : (
        <>
          <DestinationMap destinations={plotted} label={t.mapLabel} />

          <ul className="travel-list">
            {plotted.map((place) => (
              <li key={`${place.name}-${place.lat}-${place.lng}`}>
                <strong>{place.name}</strong>
                <span className="travel-country">{place.country}</span>
                {place.description ? <p>{place.description}</p> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

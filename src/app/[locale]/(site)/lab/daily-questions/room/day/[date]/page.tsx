import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DayView } from "@/features/lab/daily-questions/components/day-view";
import { buildRoomDay } from "@/features/lab/daily-questions/service";
import { getSession } from "@/features/lab/daily-questions/session";
import {
  formatUtcDate,
  isDateString,
  utcToday,
} from "@/features/lab/daily-questions/utc-day";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * A single past day of this room.
 *
 * The reveal rules are unchanged: a day you never answered stays sealed, because
 * the same server-side gate serves this page.
 */
export default async function RoomDayPage({
  params,
}: PageProps<"/[locale]/lab/daily-questions/room/day/[date]">) {
  const { locale, date } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(localizedPath(locale, "/lab/daily-questions"));

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions;
  const { room, member } = session;

  if (!isDateString(date) || date > utcToday()) notFound();

  const day = await buildRoomDay({
    room,
    memberId: member.id,
    date,
    locale,
    // Reading an old day must never trigger a new generation.
    allowGeneration: false,
  });

  return (
    <div className="shell page-wrap dq-page">
      <Link
        className="back-link"
        href={localizedPath(locale, "/lab/daily-questions/room/archive")}
      >
        ← {t.calendar.title}
      </Link>

      <header className="page-intro dq-intro">
        <p className="eyebrow">
          {day.isToday ? t.today.eyebrow : t.calendar.title}
        </p>
        <h1>{formatUtcDate(date, locale)}</h1>
      </header>

      <DayView
        copy={t}
        day={day}
        heading={
          day.isToday ? t.room.todaysQuestion : formatUtcDate(date, locale)
        }
        locale={locale}
      />
    </div>
  );
}

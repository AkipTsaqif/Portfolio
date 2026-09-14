import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar } from "@/features/lab/daily-questions/components/calendar";
import {
  getRoomCalendar,
  getRoomContext,
} from "@/features/lab/daily-questions/service";
import { getSession } from "@/features/lab/daily-questions/session";
import {
  addUtcMonths,
  isMonthKey,
  monthKey,
  utcToday,
} from "@/features/lab/daily-questions/utc-day";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/daily-questions/room/archive">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).dailyQuestions;
  return {
    title: `${t.calendar.title} — ${t.room.metaTitle}`,
    robots: { index: false, follow: false },
  };
}

const DAY_PATH = "/lab/daily-questions/room/day";

/**
 * The archive as a calendar, one month at a time.
 *
 * Each cell carries the state of that day — everyone answered, only you, only
 * them, nobody — so the shape of the ritual is legible without opening anything.
 */
export default async function RoomArchivePage({
  params,
  searchParams,
}: PageProps<"/[locale]/lab/daily-questions/room/archive">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(localizedPath(locale, "/lab/daily-questions"));

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions;
  const { room, member } = session;

  const query = await searchParams;
  const requested = Array.isArray(query.month) ? query.month[0] : query.month;
  const today = utcToday();
  // Never let a deep link scroll past the present month.
  const month =
    isMonthKey(requested) && requested <= monthKey(today)
      ? requested
      : monthKey(today);

  const [{ members }, calendar] = await Promise.all([
    getRoomContext(room, member.id),
    getRoomCalendar({
      room,
      member,
      month,
      locale,
      hrefFor: (date) => localizedPath(locale, `${DAY_PATH}/${date}`),
    }),
  ]);

  const monthHref = (value: string) =>
    `${localizedPath(locale, "/lab/daily-questions/room/archive")}?month=${value}`;

  return (
    <div className="shell page-wrap dq-page">
      <Link
        className="back-link"
        href={localizedPath(locale, "/lab/daily-questions/room")}
      >
        ← {t.room.metaTitle}
      </Link>

      <header className="page-intro dq-intro">
        <p className="eyebrow">{t.calendar.title}</p>
        <h1>{t.calendar.title}</h1>
        <div className="dq-intro-copy">
          <p>{t.calendar.description}</p>
          <p className="dq-note">
            {t.room.members}:{" "}
            {members.map((item) => item.display_name).join(" · ")}
          </p>
        </div>
      </header>

      <Calendar
        copy={t}
        locale={locale}
        month={calendar}
        nextHref={monthHref(addUtcMonths(month, 1))}
        previousHref={monthHref(addUtcMonths(month, -1))}
      />
    </div>
  );
}

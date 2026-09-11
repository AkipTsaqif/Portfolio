import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DayView } from "@/features/lab/daily-questions/components/day-view";
import { InviteLink } from "@/features/lab/daily-questions/components/invite-link";
import { RoomSettings } from "@/features/lab/daily-questions/components/room-settings";
import { StreakStrip } from "@/features/lab/daily-questions/components/streak-strip";
import { formatRoomCode } from "@/features/lab/daily-questions/code";
import {
  buildRoomDay,
  getRoomContext,
} from "@/features/lab/daily-questions/service";
import { getSession } from "@/features/lab/daily-questions/session";
import { utcToday } from "@/features/lab/daily-questions/utc-day";
import { inviteUrl } from "@/features/lab/daily-questions/urls";
import { isLocale, localizedPath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/lab/daily-questions/room">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = (await getDictionary(locale)).dailyQuestions;
  return {
    title: t.room.metaTitle,
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({
  params,
}: PageProps<"/[locale]/lab/daily-questions/room">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(localizedPath(locale, "/lab/daily-questions"));

  const dictionary = await getDictionary(locale);
  const t = dictionary.dailyQuestions;
  const { room, member } = session;
  const today = utcToday();

  const [{ members, stats }, day] = await Promise.all([
    getRoomContext(room, member.id),
    buildRoomDay({ room, memberId: member.id, date: today, locale }),
  ]);

  const formattedCode = formatRoomCode(room.code);

  return (
    <div className="shell page-wrap dq-page dq-room">
      <Link
        className="back-link"
        href={localizedPath(locale, "/lab/daily-questions")}
      >
        ← {t.metaTitle}
      </Link>

      <header className="dq-room-head">
        <div>
          <p className="eyebrow">{t.room.metaTitle}</p>
          <h1>{room.name ?? formattedCode}</h1>
          <p className="dq-room-members">
            <span className="eyebrow">{t.room.members}</span>{" "}
            {members.map((item) => item.display_name).join(" · ")}
          </p>
        </div>
        <StreakStrip copy={t} stats={stats} />
      </header>

      <DayView
        copy={t}
        day={day}
        heading={t.room.todaysQuestion}
        locale={locale}
      />

      <nav className="dq-room-nav">
        <Link href={localizedPath(locale, "/lab/daily-questions/room/archive")}>
          {t.room.calendarLink} →
        </Link>
        <Link href={localizedPath(locale, "/lab/daily-questions/archive")}>
          {t.archive.metaTitle} →
        </Link>
      </nav>

      <InviteLink
        code={room.code}
        formattedCode={formattedCode}
        url={inviteUrl(locale, room.code)}
      />

      <RoomSettings formattedCode={formattedCode} mode={room.question_mode} />
    </div>
  );
}

import Link from "next/link";
import type { Copy } from "../copy";
import type { CalendarMonth } from "../types";
import { utcWeekdayLabels } from "../utc-day";
import type { Locale } from "@/i18n/config";

/**
 * The record of the ritual: a month at a glance, each day carrying whether it
 * was answered and by whom.
 */
export function Calendar({
  copy,
  month,
  previousHref,
  nextHref,
  locale,
}: {
  copy: Copy;
  month: CalendarMonth;
  previousHref: string;
  nextHref: string;
  locale: Locale;
}) {
  const t = copy.calendar;
  const weekdayLabels = utcWeekdayLabels(locale);

  return (
    <section className="dq-calendar">
      <header className="dq-calendar-head">
        <h2>{month.label}</h2>
        <div className="dq-calendar-nav">
          <Link aria-label={t.previous} href={previousHref}>
            ←
          </Link>
          <Link aria-label={t.next} href={nextHref}>
            →
          </Link>
        </div>
      </header>

      <div className="dq-calendar-grid" role="grid">
        {weekdayLabels.map((label, index) => (
          <div
            aria-hidden="true"
            className="dq-calendar-weekday"
            key={`${label}-${index}`}
          >
            {label}
          </div>
        ))}

        {month.cells.map((cell) => {
          const label = t.status[cell.status];
          const className = [
            "dq-calendar-cell",
            cell.inMonth ? "" : "dq-calendar-outside",
            cell.isToday ? "dq-calendar-today" : "",
            `dq-calendar-${cell.status}`,
          ]
            .filter(Boolean)
            .join(" ");

          const number = Number(cell.date.slice(8, 10));

          if (!cell.href) {
            return (
              <div className={className} key={cell.date} title={label}>
                <span>{number}</span>
                <span className="sr-only">{label}</span>
              </div>
            );
          }

          return (
            <Link
              aria-label={`${cell.date} — ${label}`}
              className={className}
              href={cell.href}
              key={cell.date}
              title={label}
            >
              <span>{number}</span>
            </Link>
          );
        })}
      </div>

      <ul className="dq-legend">
        {(["complete", "partial", "locked", "none", "future"] as const).map(
          (status) => (
            <li key={status}>
              <span className={`dq-legend-dot dq-legend-${status}`} />
              {t.status[status]}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

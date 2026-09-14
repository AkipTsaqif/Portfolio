import type { RoomStats } from "../service";
import type { Copy } from "../copy";

/**
 * Two numbers: your own run, and the run you are only keeping together.
 */
export function StreakStrip({ copy, stats }: { copy: Copy; stats: RoomStats }) {
  const t = copy.room;
  const shared = stats.memberCount > 1;

  return (
    <dl className="dq-streaks">
      <div className="dq-streak">
        <dt>{t.yourStreak}</dt>
        <dd>
          <strong>{stats.myStreak}</strong>
          <span>{stats.myStreak === 1 ? t.dayUnitOne : t.dayUnit}</span>
        </dd>
      </div>
      {shared ? (
        <div className="dq-streak">
          <dt>{t.sharedStreak}</dt>
          <dd>
            <strong>{stats.sharedStreak}</strong>
            <span>{stats.sharedStreak === 1 ? t.dayUnitOne : t.dayUnit}</span>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

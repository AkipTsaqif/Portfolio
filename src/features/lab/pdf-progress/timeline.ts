export const DAY_MS = 24 * 60 * 60 * 1000;

export type ActualObservation = {
  id: string;
  date: string;
  value?: number;
};

export type TimelinePoint = {
  id: string;
  date: string;
  dateLabel: string;
  value?: number;
  kind: "actual" | "interpolated" | "forecast" | "missing";
};

export type ForecastSummary = {
  endValue: number;
  dailyRate: number;
  sampleSize: number;
  targetDate: string;
  targetDateKey: string;
};

export type TargetComparison = {
  target: number;
  forecastValue: number;
  difference: number;
  currentValue: number;
  requiredDailyRate: number;
  additionalDailyRate: number;
  days: number;
  status: "ahead" | "behind" | "met";
};

function startOfLocalDay(value: string | Date) {
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly)
      return new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      );
  }
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function differenceInDays(later: Date, earlier: Date) {
  return Math.round(
    (startOfLocalDay(later).getTime() - startOfLocalDay(earlier).getTime()) /
      DAY_MS,
  );
}

function linearRegression(observations: Array<{ date: Date; value: number }>) {
  const origin = observations[0].date;
  const samples = observations.map((observation) => ({
    x: differenceInDays(observation.date, origin),
    y: observation.value,
  }));
  const meanX =
    samples.reduce((total, sample) => total + sample.x, 0) / samples.length;
  const meanY =
    samples.reduce((total, sample) => total + sample.y, 0) / samples.length;
  const denominator = samples.reduce(
    (total, sample) => total + (sample.x - meanX) ** 2,
    0,
  );
  const slope =
    denominator === 0
      ? 0
      : samples.reduce(
          (total, sample) => total + (sample.x - meanX) * (sample.y - meanY),
          0,
        ) / denominator;
  const intercept = meanY - slope * meanX;

  return {
    origin,
    slope,
    predict: (date: Date) =>
      Math.max(0, intercept + slope * differenceInDays(date, origin)),
  };
}

export function buildTimeline(
  observations: ActualObservation[],
  forecastUntil?: string,
): { points: TimelinePoint[]; forecast?: ForecastSummary } {
  const sorted = observations
    .map((observation) => ({
      ...observation,
      parsedDate: startOfLocalDay(observation.date),
    }))
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  if (!sorted.length) return { points: [] };

  // If multiple reports have the same date, the latest uploaded observation for that day wins.
  const byDay = new Map<string, (typeof sorted)[number]>();
  for (const observation of sorted)
    byDay.set(dateKey(observation.parsedDate), observation);
  const dailyActuals = [...byDay.values()].sort(
    (a, b) => a.parsedDate.getTime() - b.parsedDate.getTime(),
  );
  const firstDay = dailyActuals[0].parsedDate;
  const lastDay = dailyActuals.at(-1)!.parsedDate;
  const known = dailyActuals.filter(
    (observation): observation is typeof observation & { value: number } =>
      observation.value !== undefined,
  );
  const points: TimelinePoint[] = [];

  for (
    let cursor = new Date(firstDay);
    cursor <= lastDay;
    cursor = addDays(cursor, 1)
  ) {
    const key = dateKey(cursor);
    const actual = byDay.get(key);
    if (actual?.value !== undefined) {
      points.push({
        id: actual.id,
        date: key,
        dateLabel: formatDate(cursor),
        value: actual.value,
        kind: "actual",
      });
      continue;
    }

    const previous = [...known]
      .reverse()
      .find((observation) => observation.parsedDate < cursor);
    const next = known.find((observation) => observation.parsedDate > cursor);
    if (previous && next) {
      const span = differenceInDays(next.parsedDate, previous.parsedDate);
      const elapsed = differenceInDays(cursor, previous.parsedDate);
      const value =
        previous.value + (next.value - previous.value) * (elapsed / span);
      points.push({
        id: `interpolated-${key}`,
        date: key,
        dateLabel: formatDate(cursor),
        value,
        kind: "interpolated",
      });
    } else {
      points.push({
        id: `missing-${key}`,
        date: key,
        dateLabel: formatDate(cursor),
        kind: "missing",
      });
    }
  }

  if (!forecastUntil || known.length < 2) return { points };
  const target = startOfLocalDay(`${forecastUntil}T00:00:00`);
  if (target <= lastDay) return { points };

  const regression = linearRegression(
    known.map(({ parsedDate, value }) => ({ date: parsedDate, value })),
  );
  for (
    let cursor = addDays(lastDay, 1);
    cursor <= target;
    cursor = addDays(cursor, 1)
  ) {
    const key = dateKey(cursor);
    points.push({
      id: `forecast-${key}`,
      date: key,
      dateLabel: formatDate(cursor),
      value: regression.predict(cursor),
      kind: "forecast",
    });
  }

  return {
    points,
    forecast: {
      endValue: regression.predict(target),
      dailyRate: regression.slope,
      sampleSize: known.length,
      targetDate: formatDate(target),
      targetDateKey: dateKey(target),
    },
  };
}

export function compareTarget(
  observations: ActualObservation[],
  forecast: ForecastSummary | undefined,
  target: number | undefined,
): TargetComparison | undefined {
  if (!forecast || target === undefined) return undefined;
  const known = observations
    .filter(
      (observation): observation is ActualObservation & { value: number } =>
        observation.value !== undefined,
    )
    .sort(
      (a, b) =>
        startOfLocalDay(a.date).getTime() - startOfLocalDay(b.date).getTime(),
    );
  const latest = known.at(-1);
  if (!latest) return undefined;

  const currentDate = startOfLocalDay(latest.date);
  const targetDate = startOfLocalDay(forecast.targetDateKey);
  const days = Math.max(1, differenceInDays(targetDate, currentDate));
  const requiredDailyRate = (target - latest.value) / days;
  const difference = forecast.endValue - target;
  const status =
    Math.abs(difference) < 0.005 ? "met" : difference > 0 ? "ahead" : "behind";

  return {
    target,
    forecastValue: forecast.endValue,
    difference,
    currentValue: latest.value,
    requiredDailyRate,
    additionalDailyRate: requiredDailyRate - forecast.dailyRate,
    days,
    status,
  };
}

export function minimumForecastDate(observations: ActualObservation[]) {
  const validDates = observations.map((observation) =>
    startOfLocalDay(observation.date),
  );
  if (!validDates.length) return "";
  const last = new Date(Math.max(...validDates.map((date) => date.getTime())));
  return dateKey(addDays(last, 1));
}

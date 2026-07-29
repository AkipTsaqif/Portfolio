"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { getAvailableMetrics, getMetricLabel } from "./metrics";
import { parseProgressPdf } from "./parser";
import { buildTimeline, compareTarget, minimumForecastDate } from "./timeline";
import { useI18n } from "@/i18n/client-context";
import type {
  EntityKind,
  MetricKey,
  ParseResult,
  ProgressReport,
} from "./types";

type Point = {
  id: string;
  date: string;
  dateLabel: string;
  value?: number;
  kind: "actual" | "interpolated" | "forecast" | "missing";
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.ceil(value),
  );
}

function formatFileName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "");
}

function formatAxisDate(value: string, includeYear = false) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: includeYear ? "2-digit" : undefined,
  }).format(new Date(year, month - 1, day));
}

function getDateTickIndexes(pointCount: number, maximumLabels = 7) {
  if (pointCount <= maximumLabels)
    return Array.from({ length: pointCount }, (_, index) => index);

  return Array.from(
    new Set(
      Array.from({ length: maximumLabels }, (_, index) =>
        Math.round((index * (pointCount - 1)) / (maximumLabels - 1)),
      ),
    ),
  );
}

function ChartTooltip({
  point,
  x,
  y,
  chartWidth,
}: {
  point: Point;
  x: number;
  y: number;
  chartWidth: number;
}) {
  if (point.value === undefined) return null;

  const tooltipWidth = 184;
  const tooltipHeight = 76;
  const tooltipX = Math.min(
    Math.max(x - tooltipWidth / 2, 8),
    chartWidth - tooltipWidth - 8,
  );
  const tooltipY = y > tooltipHeight + 28 ? y - tooltipHeight - 18 : y + 18;
  const kindLabel = point.kind.charAt(0).toUpperCase() + point.kind.slice(1);

  return (
    <g className="pdf-chart-tooltip" pointerEvents="none" role="status">
      <line className="pdf-chart-hover-line" x1={x} x2={x} y1={34} y2={342} />
      <rect
        height={tooltipHeight}
        rx="8"
        width={tooltipWidth}
        x={tooltipX}
        y={tooltipY}
      />
      <text
        className="pdf-chart-tooltip-date"
        x={tooltipX + 14}
        y={tooltipY + 22}
      >
        {point.dateLabel}
      </text>
      <text
        className="pdf-chart-tooltip-value"
        x={tooltipX + 14}
        y={tooltipY + 47}
      >
        {formatNumber(point.value)}
      </text>
      <text
        className="pdf-chart-tooltip-kind"
        textAnchor="end"
        x={tooltipX + tooltipWidth - 14}
        y={tooltipY + 47}
      >
        {kindLabel}
      </text>
      <circle
        className={`pdf-chart-tooltip-dot pdf-chart-tooltip-dot-${point.kind}`}
        cx={x}
        cy={y}
        r="8"
      />
    </g>
  );
}

function LineChart({
  points,
  label,
  target,
  currentPace,
  requiredPace,
  targetStatus,
  translations,
}: {
  points: Point[];
  label: string;
  target?: number;
  currentPace?: number;
  requiredPace?: number;
  targetStatus?: "ahead" | "behind" | "met";
  translations: {
    chartAria: string;
    target: string;
    requiredPace: string;
    currentPace: string;
    perDay: string;
  };
}) {
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const width = 1040;
  const height = 430;
  const annotationWidth =
    target === undefined
      ? 0
      : currentPace !== undefined && requiredPace !== undefined
        ? 144
        : 92;
  const padding = { top: 34, right: 24, bottom: 88, left: 62 };
  const plotRight = width - padding.right - annotationWidth;
  const chartWidth = plotRight - padding.left;
  const chartHeight = height - padding.top - padding.bottom;
  const values = [
    ...points.flatMap((point) =>
      point.value === undefined ? [] : [point.value],
    ),
    ...(target === undefined ? [] : [target]),
  ];
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;
  const xFor = (index: number) =>
    padding.left +
    (points.length === 1
      ? chartWidth / 2
      : (index / (points.length - 1)) * chartWidth);
  const hitBoundsFor = (index: number) => {
    const center = xFor(index);
    const previousCenter = index > 0 ? xFor(index - 1) : center - 32;
    const nextCenter =
      index < points.length - 1 ? xFor(index + 1) : center + 32;
    const left =
      index > 0
        ? (previousCenter + center) / 2
        : center - Math.min(16, (nextCenter - center) / 2);
    const right =
      index < points.length - 1
        ? (center + nextCenter) / 2
        : center + Math.min(16, (center - previousCenter) / 2);
    return { left, width: Math.max(right - left, 1) };
  };
  const yFor = (value: number) =>
    padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (fraction) => minValue + range * fraction,
  );
  const dateTickIndexes = getDateTickIndexes(points.length);
  const segments: Array<{ path: string; kind: Point["kind"] }> = [];
  let segment: string[] = [];
  let segmentKind: Point["kind"] = "actual";

  points.forEach((point, index) => {
    if (point.value === undefined) {
      if (segment.length)
        segments.push({ path: segment.join(" "), kind: segmentKind });
      segment = [];
      return;
    }
    if (segment.length && point.kind !== segmentKind) {
      segments.push({ path: segment.join(" "), kind: segmentKind });
      segment = [
        `${xFor(index - 1)},${yFor(points[index - 1].value!)}`,
        `${xFor(index)},${yFor(point.value)}`,
      ];
    } else {
      segment.push(`${xFor(index)},${yFor(point.value)}`);
    }
    segmentKind = point.kind;
  });
  if (segment.length)
    segments.push({ path: segment.join(" "), kind: segmentKind });

  const activePointIndex = points.findIndex(
    (point) => point.id === activePointId,
  );
  const activePoint =
    activePointIndex >= 0 ? points[activePointIndex] : undefined;
  const lastActualIndex = points.findLastIndex(
    (point) => point.kind === "actual" && point.value !== undefined,
  );
  const finalForecastIndex = points.findLastIndex(
    (point) => point.kind === "forecast" && point.value !== undefined,
  );
  const finalForecast =
    finalForecastIndex >= 0 ? points[finalForecastIndex] : undefined;
  const hasTargetGap =
    target !== undefined &&
    currentPace !== undefined &&
    requiredPace !== undefined &&
    lastActualIndex >= 0 &&
    finalForecast?.value !== undefined;
  const targetLabelY = target === undefined ? 0 : yFor(target);
  const forecastLabelY =
    finalForecast?.value === undefined ? 0 : yFor(finalForecast.value);
  const labelsAreClose = Math.abs(targetLabelY - forecastLabelY) < 44;
  const requiredAnnotationY = labelsAreClose
    ? Math.max(padding.top + 18, Math.min(targetLabelY, forecastLabelY) - 24)
    : targetLabelY;
  const currentAnnotationY = labelsAreClose
    ? Math.min(
        height - padding.bottom - 18,
        Math.max(targetLabelY, forecastLabelY) + 24,
      )
    : forecastLabelY;

  return (
    <div className="pdf-chart-wrap">
      <svg
        aria-label={`${label} ${translations.chartAria}`}
        className="pdf-chart"
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") setActivePointId(null);
        }}
        role="group"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>{label} over time</title>
        {ticks.map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line
                className="pdf-chart-gridline"
                x1={padding.left}
                x2={plotRight}
                y1={y}
                y2={y}
              />
              <text
                className="pdf-chart-label"
                textAnchor="end"
                x={padding.left - 12}
                y={y + 4}
              >
                {formatNumber(tick)}
              </text>
            </g>
          );
        })}
        {hasTargetGap ? (
          <g className={`pdf-chart-gap pdf-chart-gap-${targetStatus ?? "met"}`}>
            <polygon
              points={`${xFor(lastActualIndex)},${yFor(points[lastActualIndex].value!)} ${xFor(finalForecastIndex)},${yFor(finalForecast!.value!)} ${xFor(finalForecastIndex)},${yFor(target!)}`}
            />
            <line
              className="pdf-chart-required-line"
              x1={xFor(lastActualIndex)}
              x2={xFor(finalForecastIndex)}
              y1={yFor(points[lastActualIndex].value!)}
              y2={yFor(target!)}
            />
          </g>
        ) : null}
        {target !== undefined ? (
          <g className="pdf-chart-target">
            <line
              x1={padding.left}
              x2={plotRight}
              y1={yFor(target)}
              y2={yFor(target)}
            />
          </g>
        ) : null}
        {dateTickIndexes.map((index, tickPosition) => {
          const point = points[index];
          const isBoundary =
            tickPosition === 0 || tickPosition === dateTickIndexes.length - 1;
          return (
            <g key={`date-tick-${point.id}`}>
              <line
                className="pdf-chart-tick"
                x1={xFor(index)}
                x2={xFor(index)}
                y1={height - padding.bottom}
                y2={height - padding.bottom + 7}
              />
              <text
                className="pdf-chart-label pdf-chart-date"
                textAnchor="end"
                transform={`rotate(-32 ${xFor(index)} ${height - padding.bottom + 24})`}
                x={xFor(index)}
                y={height - padding.bottom + 24}
              >
                {formatAxisDate(point.date, isBoundary)}
              </text>
            </g>
          );
        })}
        {segments.map((segment) => (
          <polyline
            className={`pdf-chart-line pdf-chart-line-${segment.kind}`}
            key={`${segment.kind}-${segment.path}`}
            points={segment.path}
          />
        ))}
        {points.map((point, index) =>
          point.value === undefined ? null : (
            <g
              aria-label={`${point.dateLabel}: ${formatNumber(point.value)}, ${point.kind}`}
              className="pdf-chart-interaction-point"
              key={`${point.id}-point`}
              onBlur={() => setActivePointId(null)}
              onFocus={() => setActivePointId(point.id)}
              onPointerDown={() =>
                setActivePointId((current) =>
                  current === point.id ? null : point.id,
                )
              }
              onPointerEnter={() => setActivePointId(point.id)}
              onPointerLeave={(event) => {
                if (event.pointerType !== "touch") setActivePointId(null);
              }}
              role="button"
              tabIndex={0}
            >
              <circle
                className={`pdf-chart-point pdf-chart-point-${point.kind}`}
                cx={xFor(index)}
                cy={yFor(point.value)}
                r={point.kind === "actual" ? 6 : 4}
              />
              <rect
                className="pdf-chart-hit-area"
                height="32"
                width={hitBoundsFor(index).width}
                x={hitBoundsFor(index).left}
                y={yFor(point.value) - 16}
              />
            </g>
          ),
        )}
        {hasTargetGap ? (
          <g className="pdf-chart-pace-annotations">
            <line
              className="pdf-chart-annotation-guide required"
              x1={plotRight}
              x2={plotRight + 14}
              y1={targetLabelY}
              y2={requiredAnnotationY}
            />
            <circle
              className="pdf-chart-annotation-dot required"
              cx={plotRight}
              cy={targetLabelY}
              r="4"
            />
            <text
              className="pdf-chart-annotation-kicker"
              x={plotRight + 20}
              y={requiredAnnotationY - 7}
            >
              {translations.requiredPace}
            </text>
            <text
              className="pdf-chart-annotation-value"
              x={plotRight + 20}
              y={requiredAnnotationY + 12}
            >
              {requiredPace! >= 0 ? "+" : ""}
              {formatNumber(requiredPace!)} {translations.perDay}
            </text>
            <line
              className="pdf-chart-annotation-guide current"
              x1={plotRight}
              x2={plotRight + 14}
              y1={forecastLabelY}
              y2={currentAnnotationY}
            />
            <circle
              className="pdf-chart-annotation-dot current"
              cx={plotRight}
              cy={forecastLabelY}
              r="4"
            />
            <text
              className="pdf-chart-annotation-kicker"
              x={plotRight + 20}
              y={currentAnnotationY - 7}
            >
              {translations.currentPace}
            </text>
            <text
              className="pdf-chart-annotation-value"
              x={plotRight + 20}
              y={currentAnnotationY + 12}
            >
              {currentPace! >= 0 ? "+" : ""}
              {formatNumber(currentPace!)} {translations.perDay}
            </text>
          </g>
        ) : target !== undefined ? (
          <g className="pdf-chart-pace-annotations">
            <circle
              className="pdf-chart-annotation-dot required"
              cx={plotRight}
              cy={targetLabelY}
              r="4"
            />
            <text
              className="pdf-chart-annotation-kicker"
              x={plotRight + 20}
              y={targetLabelY - 7}
            >
              {translations.target}
            </text>
            <text
              className="pdf-chart-annotation-value"
              x={plotRight + 20}
              y={targetLabelY + 12}
            >
              {formatNumber(target)}
            </text>
          </g>
        ) : null}
        {activePoint?.value !== undefined ? (
          <ChartTooltip
            chartWidth={plotRight}
            point={activePoint}
            x={xFor(activePointIndex)}
            y={yFor(activePoint.value)}
          />
        ) : null}
      </svg>
      <p className="pdf-chart-caption">
        {label} · actual, interpolated, and forecast values are shown separately
      </p>
    </div>
  );
}

export function PdfProgressTool() {
  const { dictionary } = useI18n();
  const t = dictionary.pdfTool;
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [entityKind, setEntityKind] = useState<EntityKind>("pcl");
  const [metric, setMetric] = useState<MetricKey>("jmlSubmit");
  const [selectedName, setSelectedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [forecastUntil, setForecastUntil] = useState("");
  const [targetInput, setTargetInput] = useState("");

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => a.date.localeCompare(b.date)),
    [reports],
  );
  const availableMetrics = useMemo(
    () => getAvailableMetrics(sortedReports, entityKind),
    [sortedReports, entityKind],
  );
  const names = useMemo(() => {
    if (entityKind === "overall") return ["Whole report"];
    const allNames = new Set(
      sortedReports.flatMap((report) =>
        report[entityKind].map((entity) => entity.name),
      ),
    );
    return [...allNames].sort((a, b) => a.localeCompare(b));
  }, [sortedReports, entityKind]);
  const activeName = names.includes(selectedName)
    ? selectedName
    : (names[0] ?? "");
  const activeMetric = availableMetrics.some((item) => item.key === metric)
    ? metric
    : availableMetrics[0]?.key;
  const observations = useMemo(
    () =>
      sortedReports.map((report) => ({
        id: report.id,
        date: report.date,
        value: report[entityKind].find((entity) => entity.name === activeName)
          ?.metrics[activeMetric as MetricKey],
      })),
    [activeMetric, activeName, entityKind, sortedReports],
  );
  const timeline = useMemo(
    () => buildTimeline(observations, forecastUntil),
    [forecastUntil, observations],
  );
  const target = targetInput === "" ? undefined : Number(targetInput);
  const validTarget =
    target !== undefined && Number.isFinite(target) && target >= 0
      ? target
      : undefined;
  const targetComparison = useMemo(
    () => compareTarget(observations, timeline.forecast, validTarget),
    [observations, timeline.forecast, validTarget],
  );
  const points = timeline.points;
  const missingPoints = points.filter(
    (point) => point.kind === "missing",
  ).length;
  const minimumDate = minimumForecastDate(observations);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setLoading(true);
    setErrors([]);
    setWarnings([]);
    try {
      const results = await Promise.all(
        files.map(async (file): Promise<ParseResult | null> => {
          try {
            return await parseProgressPdf(file);
          } catch (error) {
            setErrors((current) => [
              ...current,
              `${file.name}: ${error instanceof Error ? error.message : "Could not read this PDF."}`,
            ]);
            return null;
          }
        }),
      );
      const parsed = results.flatMap((result) => (result ? [result] : []));
      setReports(parsed.map((result) => result.report));
      setWarnings(
        parsed.flatMap((result) =>
          result.warnings.map(
            (warning) => `${result.report.fileName}: ${warning}`,
          ),
        ),
      );
      setSelectedName("");
      setMetric("jmlSubmit");
      setForecastUntil("");
      setTargetInput("");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  function handleEntityKindChange(nextKind: EntityKind) {
    setEntityKind(nextKind);
    setSelectedName("");
    const nextMetrics = getAvailableMetrics(sortedReports, nextKind);
    if (!nextMetrics.some((item) => item.key === metric))
      setMetric(nextMetrics[0]?.key ?? "jmlSubmit");
  }

  return (
    <div className="pdf-tool">
      <section
        className="pdf-upload-panel"
        aria-labelledby="pdf-upload-heading"
      >
        <div>
          <p className="eyebrow">{t.stepUpload}</p>
          <h2 id="pdf-upload-heading">{t.uploadTitle}</h2>
          <p>{t.uploadDescription}</p>
        </div>
        <label className="pdf-upload-button">
          <input
            accept="application/pdf,.pdf"
            multiple
            onChange={handleFiles}
            type="file"
          />
          {loading ? t.readingFiles : t.chooseFiles}
        </label>
        <p className="pdf-local-note">
          <span aria-hidden="true">●</span> {t.localNote}
        </p>
      </section>

      {errors.length > 0 ? (
        <div className="pdf-messages pdf-errors" role="alert">
          <strong>{t.errorsTitle}</strong>
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="pdf-messages pdf-warnings">
          <strong>{t.warningsTitle}</strong>
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {sortedReports.length > 0 ? (
        <>
          <section className="pdf-controls" aria-label={t.stepChart}>
            <div className="pdf-control-group">
              <label htmlFor="entity-kind">{t.view}</label>
              <select
                id="entity-kind"
                onChange={(event) =>
                  handleEntityKindChange(event.target.value as EntityKind)
                }
                value={entityKind}
              >
                <option value="overall">{t.wholeReport}</option>
                <option value="pcl">{t.pcl}</option>
                <option value="pml">{t.pml}</option>
              </select>
            </div>
            <div className="pdf-control-group pdf-name-control">
              <label htmlFor="entity-name">{t.person}</label>
              <select
                id="entity-name"
                onChange={(event) => setSelectedName(event.target.value)}
                value={activeName}
              >
                {names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="pdf-control-group">
              <label htmlFor="forecast-until">{t.forecastUntil}</label>
              <input
                id="forecast-until"
                min={minimumDate}
                onChange={(event) => setForecastUntil(event.target.value)}
                type="date"
                value={forecastUntil}
              />
            </div>
            <div className="pdf-control-group">
              <label htmlFor="target-value">{t.target}</label>
              <input
                id="target-value"
                min="0"
                onChange={(event) => setTargetInput(event.target.value)}
                placeholder={t.desiredTotal}
                step="any"
                type="number"
                value={targetInput}
              />
            </div>
            <div className="pdf-control-group">
              <label htmlFor="metric">{t.metric}</label>
              <select
                disabled={!availableMetrics.length}
                id="metric"
                onChange={(event) => setMetric(event.target.value as MetricKey)}
                value={activeMetric ?? ""}
              >
                {availableMetrics.map((definition) => (
                  <option key={definition.key} value={definition.key}>
                    {definition.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="pdf-chart-panel" aria-labelledby="chart-heading">
            <div className="pdf-chart-heading">
              <div>
                <p className="eyebrow">{t.stepChart}</p>
                <h2 id="chart-heading">{activeName || t.choosePerson}</h2>
              </div>
              <p>
                {activeMetric ? getMetricLabel(activeMetric) : t.noSharedMetric}
              </p>
            </div>
            {availableMetrics.length && activeName ? (
              <LineChart
                label={`${activeName} · ${getMetricLabel(activeMetric!)}`}
                points={points}
                target={validTarget}
                currentPace={timeline.forecast?.dailyRate}
                requiredPace={targetComparison?.requiredDailyRate}
                targetStatus={targetComparison?.status}
                translations={{
                  chartAria: t.chartAria,
                  target: t.targetLabel,
                  requiredPace: t.requiredPace,
                  currentPace: t.currentPace,
                  perDay: t.perDay,
                }}
              />
            ) : (
              <p className="pdf-no-chart">{t.noSharedMetric}</p>
            )}
            <div className="pdf-chart-legend" aria-label="Chart legend">
              <span>
                <i className="legend-dot legend-actual" /> {t.actual}
              </span>
              <span>
                <i className="legend-dot legend-interpolated" />{" "}
                {t.interpolated}
              </span>
              {timeline.forecast ? (
                <span>
                  <i className="legend-dot legend-forecast" /> {t.forecast}
                </span>
              ) : null}
            </div>
            {missingPoints > 0 ? (
              <p className="pdf-missing-note">
                {missingPoints} {t.missingDays}
              </p>
            ) : null}
            {timeline.forecast ? (
              <div className="pdf-forecast-summary">
                <strong>
                  {t.estimate} {formatNumber(timeline.forecast.endValue)}
                </strong>
                <span>
                  {t.by} {timeline.forecast.targetDate}
                </span>
                <span>
                  {t.trend}: {timeline.forecast.dailyRate >= 0 ? "+" : ""}
                  {formatNumber(timeline.forecast.dailyRate)} {t.perDay}
                </span>
                <small>{t.forecastDisclaimer}</small>
              </div>
            ) : null}
            {validTarget !== undefined && !forecastUntil ? (
              <p className="pdf-target-prompt">{t.forecastPrompt}</p>
            ) : null}
            {validTarget !== undefined &&
            forecastUntil &&
            !timeline.forecast ? (
              <p className="pdf-target-prompt">{t.insufficientForecast}</p>
            ) : null}
            {targetComparison ? (
              <div
                className={`pdf-target-analysis target-${targetComparison.status}`}
              >
                <div>
                  <p className="eyebrow">{t.targetAnalysis}</p>
                  <h3>
                    {targetComparison.status === "behind"
                      ? `${formatNumber(Math.abs(targetComparison.difference))} ${t.shortOfTarget}`
                      : targetComparison.status === "ahead"
                        ? `${formatNumber(targetComparison.difference)} ${t.aboveTarget}`
                        : t.forecastMeets}
                  </h3>
                </div>
                <dl>
                  <div>
                    <dt>{t.target}</dt>
                    <dd>{formatNumber(targetComparison.target)}</dd>
                  </div>
                  <div>
                    <dt>Forecast</dt>
                    <dd>{formatNumber(targetComparison.forecastValue)}</dd>
                  </div>
                  <div>
                    <dt>{t.currentActual}</dt>
                    <dd>{formatNumber(targetComparison.currentValue)}</dd>
                  </div>
                  <div>
                    <dt>{t.daysRemaining}</dt>
                    <dd>{targetComparison.days}</dd>
                  </div>
                  <div>
                    <dt>{t.requiredPace}</dt>
                    <dd>
                      {targetComparison.requiredDailyRate >= 0 ? "+" : ""}
                      {formatNumber(targetComparison.requiredDailyRate)}{" "}
                      {t.perDay}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.currentPace}</dt>
                    <dd>
                      {targetComparison.requiredDailyRate -
                        targetComparison.additionalDailyRate >=
                      0
                        ? "+"
                        : ""}
                      {formatNumber(
                        targetComparison.requiredDailyRate -
                          targetComparison.additionalDailyRate,
                      )}{" "}
                      {t.perDay}
                    </dd>
                  </div>
                </dl>
                <p>
                  {targetComparison.status === "behind"
                    ? t.behindAction
                        .replace(
                          "{required}",
                          formatNumber(targetComparison.requiredDailyRate),
                        )
                        .replace(
                          "{additional}",
                          formatNumber(
                            Math.max(0, targetComparison.additionalDailyRate),
                          ),
                        )
                    : targetComparison.status === "ahead"
                      ? t.aheadAction
                          .replace(
                            "{difference}",
                            formatNumber(targetComparison.difference),
                          )
                          .replace(
                            "{required}",
                            formatNumber(targetComparison.requiredDailyRate),
                          )
                      : t.metAction.replace(
                          "{required}",
                          formatNumber(targetComparison.requiredDailyRate),
                        )}
                </p>
              </div>
            ) : null}
          </section>

          <section className="pdf-report-list" aria-label={t.loadedReports}>
            <p className="eyebrow">{t.loadedReports}</p>
            <div>
              {sortedReports.map((report) => (
                <span key={report.id}>
                  {report.dateLabel} · {formatFileName(report.fileName)} ·{" "}
                  {report.format === "legacy"
                    ? t.legacyFormat
                    : t.currentFormat}
                </span>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="pdf-empty-state">
          <p className="eyebrow">{t.waiting}</p>
          <p>{t.waitingDescription}</p>
        </section>
      )}

      <p className="pdf-supported-metrics">
        {t.supportedMetrics} {t.jmlSubmitNote}
      </p>
    </div>
  );
}

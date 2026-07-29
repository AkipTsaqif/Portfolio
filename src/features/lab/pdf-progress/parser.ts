import type {
  MetricKey,
  ParseResult,
  ProgressEntity,
  ProgressReport,
  ReportFormat,
} from "./types";

type PdfTextItem = {
  str: string;
  transform: number[];
};

type PositionedText = { x: number; y: number; text: string };
type TextRow = { y: number; items: PositionedText[] };

type Column = { key: MetricKey; x: number };

const currentPmlColumns: Column[] = [
  { key: "pclCount", x: 279 },
  { key: "jmlSubmit", x: 664 },
  { key: "approve", x: 702 },
  { key: "reject", x: 743 },
  { key: "revoke", x: 786 },
];

const legacyPmlColumns: Column[] = [
  { key: "pclCount", x: 238 },
  { key: "jmlSubmit", x: 282 },
  { key: "approve", x: 551 },
  { key: "reject", x: 589 },
  { key: "revoke", x: 625 },
];

const currentPclColumns: Column[] = [
  { key: "jmlSubmit", x: 268 },
  { key: "kDtm", x: 342 },
  { key: "kBru", x: 366 },
  { key: "kMng", x: 390 },
  { key: "kTe", x: 413 },
  { key: "kTdd", x: 435 },
  { key: "kTdt", x: 457 },
  { key: "kKhs", x: 481 },
  { key: "uTtp", x: 549 },
  { key: "uGnd", x: 571 },
  { key: "uTdd", x: 593 },
];

const legacyPclColumns: Column[] = [
  { key: "jmlSubmit", x: 285 },
  { key: "kDtm", x: 456 },
  { key: "kBru", x: 479 },
  { key: "kMng", x: 503 },
  { key: "kTe", x: 526 },
  { key: "kTdd", x: 549 },
  { key: "kTdt", x: 570 },
  { key: "kKhs", x: 594 },
  { key: "uTtp", x: 645 },
  { key: "uGnd", x: 668 },
  { key: "uTdd", x: 689 },
];

const monthLookup: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function rowsFromItems(items: PdfTextItem[]) {
  const groups = new Map<number, PositionedText[]>();
  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;
    const positioned = {
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      text,
    };
    const existing = groups.get(positioned.y) ?? [];
    existing.push(positioned);
    groups.set(positioned.y, existing);
  }

  return [...groups.entries()]
    .map(([y, rowItems]) => ({ y, items: rowItems.sort((a, b) => a.x - b.x) }))
    .sort((a, b) => b.y - a.y);
}

function rowText(row: TextRow) {
  return row.items.map((item) => item.text).join(" ");
}

function parseNumber(value?: string) {
  if (!value) return undefined;
  const normalized = value
    .replace(/[%.,](?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace("%", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function valueNear(row: TextRow, x: number, tolerance = 7) {
  const candidate = row.items
    .filter((item) => /^-?\d+(?:[.,]\d+)?%?$/.test(item.text))
    .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  if (!candidate || Math.abs(candidate.x - x) > tolerance) return undefined;
  return parseNumber(candidate.text);
}

function textInRange(row: TextRow, start: number, end: number) {
  return row.items
    .filter((item) => item.x >= start && item.x < end)
    .map((item) => item.text)
    .join(" ")
    .trim();
}

function parseMetrics(row: TextRow, columns: Column[]) {
  const metrics: Partial<Record<MetricKey, number>> = {};
  for (const column of columns) {
    const value = valueNear(row, column.x);
    if (value !== undefined) metrics[column.key] = value;
  }
  return metrics;
}

function isDataRow(row: TextRow, expectedX = 48) {
  return row.items.some(
    (item) => Math.abs(item.x - expectedX) <= 6 && /^\d{1,3}$/.test(item.text),
  );
}

function extractPml(rows: TextRow[], format: ReportFormat) {
  const sectionStart = rows.findIndex((row) =>
    rowText(row).includes("TABEL REKAPITULASI PROGRESS"),
  );
  const sectionEnd = rows.findIndex((row) =>
    rowText(row).includes("DAFTAR PROGRESS MITRA"),
  );
  if (sectionStart < 0 || sectionEnd < 0) return [];

  const columns = format === "legacy" ? legacyPmlColumns : currentPmlColumns;
  const nameStart = 60;
  const nameEnd = format === "legacy" ? 220 : 240;
  return rows
    .slice(sectionStart + 1, sectionEnd)
    .filter((row) => isDataRow(row, 52))
    .map((row) => ({
      name: textInRange(row, nameStart, nameEnd),
      metrics: parseMetrics(row, columns),
    }))
    .filter((entity) => entity.name && entity.metrics.jmlSubmit !== undefined);
}

function extractPcl(pageRows: TextRow[][], format: ReportFormat) {
  const columns = format === "legacy" ? legacyPclColumns : currentPclColumns;
  const entities: ProgressEntity[] = [];

  for (const rows of pageRows) {
    const headerIndex = rows.findIndex((row) => {
      const text = rowText(row);
      return text.includes("Nama Petugas") && text.includes("Nama Pengawas");
    });
    if (headerIndex < 0) continue;

    for (const row of rows.slice(headerIndex + 1)) {
      if (!isDataRow(row)) continue;
      const name = textInRange(row, 56, format === "legacy" ? 137 : 149);
      if (!name) continue;
      const metrics = parseMetrics(row, columns);
      if (metrics.jmlSubmit === undefined) continue;
      entities.push({
        name,
        supervisor: textInRange(
          row,
          format === "legacy" ? 189 : 201,
          format === "legacy" ? 247 : 268,
        ),
        metrics,
      });
    }
  }

  return entities;
}

function parseReportDate(text: string) {
  const match = text.match(
    /Tanggal Data\s*:?\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),\s*(\d{1,2}):(\d{2})/i,
  );
  if (!match) throw new Error("The report date could not be found.");
  const month = monthLookup[match[2].toLowerCase()];
  if (month === undefined)
    throw new Error("The report month is not recognized.");
  const date = new Date(
    Number(match[3]),
    month,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
  );
  return {
    iso: date.toISOString(),
    label: new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  };
}

export async function parseProgressPdf(file: File): Promise<ParseResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  const pages: TextRow[][] = [];
  const fullText: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = rowsFromItems(content.items as PdfTextItem[]);
      pages.push(rows);
      fullText.push(rows.map(rowText).join("\n"));
    }
  } finally {
    await task.destroy();
  }

  const text = fullText.join("\n");
  if (
    !text.includes("SENSUS EKONOMI 2026") ||
    !text.includes("DAFTAR PROGRESS MITRA")
  ) {
    throw new Error("This PDF is not a supported SE2026 progress report.");
  }

  const format: ReportFormat = text.includes("Target Awal Real Drft")
    ? "legacy"
    : "current";
  const date = parseReportDate(text);
  const pml = extractPml(pages[0], format);
  const pcl = extractPcl(pages, format);
  const warnings: string[] = [];

  if (!pml.length) warnings.push("No supervisor (PML) rows could be read.");
  if (!pcl.length) warnings.push("No field worker (PCL) rows could be read.");
  if (pcl.length && pcl.length < 31)
    warnings.push(`Read ${pcl.length} PCL rows; the report may contain more.`);

  const overallMetrics = pcl.reduce<Partial<Record<MetricKey, number>>>(
    (totals, entity) => {
      for (const [key, value] of Object.entries(entity.metrics) as [
        MetricKey,
        number,
      ][]) {
        totals[key] = (totals[key] ?? 0) + value;
      }
      return totals;
    },
    {},
  );

  const report: ProgressReport = {
    id: `${file.name}-${file.lastModified}-${date.iso}`,
    fileName: file.name,
    date: date.iso,
    dateLabel: date.label,
    format,
    overall: [{ name: "Whole report", metrics: overallMetrics }],
    pml,
    pcl,
  };

  return { report, warnings };
}

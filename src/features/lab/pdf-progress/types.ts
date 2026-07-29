export type ReportFormat = "current" | "legacy";
export type EntityKind = "overall" | "pml" | "pcl";

export type MetricKey =
  | "jmlSubmit"
  | "pclCount"
  | "approve"
  | "reject"
  | "revoke"
  | "kDtm"
  | "kBru"
  | "kMng"
  | "kTe"
  | "kTdd"
  | "kTdt"
  | "kKhs"
  | "uTtp"
  | "uGnd"
  | "uTdd";

export type MetricDefinition = {
  key: MetricKey;
  label: string;
  kinds: EntityKind[];
};

export type ProgressEntity = {
  name: string;
  supervisor?: string;
  metrics: Partial<Record<MetricKey, number>>;
};

export type ProgressReport = {
  id: string;
  fileName: string;
  date: string;
  dateLabel: string;
  format: ReportFormat;
  overall: ProgressEntity[];
  pml: ProgressEntity[];
  pcl: ProgressEntity[];
};

export type ParseResult = {
  report: ProgressReport;
  warnings: string[];
};

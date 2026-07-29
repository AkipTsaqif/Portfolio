import type {
  EntityKind,
  MetricDefinition,
  MetricKey,
  ProgressReport,
} from "./types";

export const metricDefinitions: MetricDefinition[] = [
  {
    key: "jmlSubmit",
    label: "Jml Submit (Real)",
    kinds: ["overall", "pml", "pcl"],
  },
  { key: "pclCount", label: "Jumlah PCL", kinds: ["pml"] },
  { key: "approve", label: "Approve", kinds: ["pml"] },
  { key: "reject", label: "Reject", kinds: ["pml"] },
  { key: "revoke", label: "Revoke", kinds: ["pml"] },
  { key: "kDtm", label: "K.Dtm", kinds: ["pcl"] },
  { key: "kBru", label: "K.Bru", kinds: ["pcl"] },
  { key: "kMng", label: "K.Mng", kinds: ["pcl"] },
  { key: "kTe", label: "K.TE", kinds: ["pcl"] },
  { key: "kTdd", label: "K.TDD", kinds: ["pcl"] },
  { key: "kTdt", label: "K.TDT", kinds: ["pcl"] },
  { key: "kKhs", label: "K.Khs", kinds: ["pcl"] },
  { key: "uTtp", label: "U.Ttp", kinds: ["pcl"] },
  { key: "uGnd", label: "U.Gnd", kinds: ["pcl"] },
  { key: "uTdd", label: "U.TDD", kinds: ["pcl"] },
];

export function getAvailableMetrics(
  reports: ProgressReport[],
  kind: EntityKind,
) {
  if (!reports.length) return [];

  return metricDefinitions.filter((definition) => {
    if (!definition.kinds.includes(kind)) return false;
    return reports.every((report) => {
      const entities = report[kind];
      return (
        entities.length > 0 &&
        entities.every((entity) => definition.key in entity.metrics)
      );
    });
  });
}

export function getMetricLabel(key: MetricKey) {
  return metricDefinitions.find((metric) => metric.key === key)?.label ?? key;
}

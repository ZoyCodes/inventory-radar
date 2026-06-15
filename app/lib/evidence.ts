import type { EnrichedReport, ReportUpdateStatus } from "./types";

export type EvidenceStatus =
  | "likely_in_stock"
  | "recently_seen"
  | "mixed_reports"
  | "likely_gone"
  | "stale";

export type TimelineEventType = "initial_sighting" | "still_there" | "gone" | "restocked";

export type EvidenceTimelineEvent = {
  type: TimelineEventType;
  reportId: string;
  reportUpdateId: string | null;
  createdAt: string;
  createdBy: string | null;
  displayLabel: string;
  productName?: string | null;
  rawProductText?: string | null;
};

export type EvidenceSummary = {
  evidenceKey: string;
  storeId: string;
  productId: string | null;
  productName?: string | null;
  rawProductText?: string | null;
  evidenceStatus: EvidenceStatus;
  firstSpottedAt: string;
  lastActivityAt: string;
  lastPositiveAt: string | null;
  lastNegativeAt: string | null;
  initialReportCount: number;
  confirmationCount: number;
  goneCount: number;
  restockCount: number;
  positiveCount: number;
  negativeCount: number;
  distinctContributorCount: number;
  timelineEvents: EvidenceTimelineEvent[];
};

type EvidenceSignal = "positive" | "negative";

type ReportCurrentSignal = {
  reportId: string;
  signal: EvidenceSignal;
  createdAt: string;
};

const freshWindowMs = 24 * 60 * 60 * 1000;

export function buildEvidenceSummaries(
  reports: EnrichedReport[],
  options: { now?: Date } = {}
): EvidenceSummary[] {
  const now = options.now ?? new Date();
  const groups = new Map<string, EnrichedReport[]>();

  for (const report of reports) {
    const key = buildEvidenceKey(report);
    const group = groups.get(key) ?? [];
    group.push(report);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([evidenceKey, groupReports]) => buildEvidenceSummary(evidenceKey, groupReports, now))
    .sort((left, right) => Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt));
}

function buildEvidenceSummary(
  evidenceKey: string,
  reports: EnrichedReport[],
  now: Date
): EvidenceSummary {
  const sortedReports = reports.slice().sort(compareCreatedAtAsc);
  const firstReport = sortedReports[0];
  const timelineEvents = sortedReports
    .flatMap(toTimelineEvents)
    .sort(compareTimelineEventsAsc);
  const contributors = new Set(
    timelineEvents.map((event) => event.createdBy).filter((createdBy): createdBy is string => Boolean(createdBy))
  );
  const firstSpottedAt = sortedReports[0].createdAt;
  const lastActivityAt = timelineEvents.at(-1)?.createdAt ?? firstSpottedAt;
  const positiveEvents = timelineEvents.filter(isPositiveEvent);
  const negativeEvents = timelineEvents.filter(isNegativeEvent);
  const lastPositiveAt = positiveEvents.at(-1)?.createdAt ?? null;
  const lastNegativeAt = negativeEvents.at(-1)?.createdAt ?? null;
  const currentSignals = sortedReports.map(getReportCurrentSignal).filter(Boolean) as ReportCurrentSignal[];

  return {
    evidenceKey,
    storeId: firstReport.storeId,
    productId: firstReport.productId ?? null,
    productName: firstReport.product?.canonicalName ?? null,
    rawProductText: firstReport.product ? null : firstReport.rawProductText ?? null,
    evidenceStatus: getEvidenceStatus({
      now,
      lastActivityAt,
      lastPositiveAt,
      lastNegativeAt,
      distinctContributorCount: contributors.size,
      currentSignals
    }),
    firstSpottedAt,
    lastActivityAt,
    lastPositiveAt,
    lastNegativeAt,
    initialReportCount: sortedReports.length,
    confirmationCount: timelineEvents.filter((event) => event.type === "still_there").length,
    goneCount: negativeEvents.length,
    restockCount: timelineEvents.filter((event) => event.type === "restocked").length,
    positiveCount: positiveEvents.length,
    negativeCount: negativeEvents.length,
    distinctContributorCount: contributors.size,
    timelineEvents
  };
}

function getEvidenceStatus(input: {
  now: Date;
  lastActivityAt: string;
  lastPositiveAt: string | null;
  lastNegativeAt: string | null;
  distinctContributorCount: number;
  currentSignals: ReportCurrentSignal[];
}): EvidenceStatus {
  const lastActivityMs = Date.parse(input.lastActivityAt);
  if (input.now.getTime() - lastActivityMs > freshWindowMs) return "stale";

  const freshSignals = input.currentSignals.filter(
    (signal) => input.now.getTime() - Date.parse(signal.createdAt) <= freshWindowMs
  );
  const hasFreshPositive = Boolean(input.lastPositiveAt)
    && input.now.getTime() - Date.parse(input.lastPositiveAt!) <= freshWindowMs;
  const hasCurrentPositive = freshSignals.some((signal) => signal.signal === "positive");
  const hasCurrentNegative = freshSignals.some((signal) => signal.signal === "negative");

  if (hasCurrentPositive && hasCurrentNegative) return "mixed_reports";
  if (
    input.lastNegativeAt
    && (!input.lastPositiveAt || Date.parse(input.lastNegativeAt) > Date.parse(input.lastPositiveAt))
  ) {
    return "likely_gone";
  }
  if (hasFreshPositive && input.distinctContributorCount >= 2) return "likely_in_stock";
  if (hasFreshPositive) return "recently_seen";
  return "stale";
}

function toTimelineEvents(report: EnrichedReport): EvidenceTimelineEvent[] {
  const productName = report.product?.canonicalName ?? null;
  const rawProductText = report.product ? null : report.rawProductText ?? null;
  const initialEvent: EvidenceTimelineEvent = {
    type: "initial_sighting",
    reportId: report.id,
    reportUpdateId: null,
    createdAt: report.createdAt,
    createdBy: report.createdBy ?? null,
    displayLabel: "Initial sighting reported",
    productName,
    rawProductText
  };

  const updateEvents = report.updates
    .filter((update) => isTimelineUpdateStatus(update.status))
    .map((update) => ({
      type: update.status as TimelineEventType,
      reportId: report.id,
      reportUpdateId: update.id,
      createdAt: update.createdAt,
      createdBy: update.createdBy ?? null,
      displayLabel: updateLabel(update.status),
      productName,
      rawProductText
    }));

  return [initialEvent, ...updateEvents];
}

function getReportCurrentSignal(report: EnrichedReport): ReportCurrentSignal {
  const latestEvent = toTimelineEvents(report).sort(compareTimelineEventsAsc).at(-1);
  return {
    reportId: report.id,
    signal: latestEvent && isNegativeEvent(latestEvent) ? "negative" : "positive",
    createdAt: latestEvent?.createdAt ?? report.createdAt
  };
}

function buildEvidenceKey(report: EnrichedReport) {
  if (report.productId) return `${report.storeId}:product:${report.productId}`;
  const normalizedRawProductText = normalizeRawProductText(report.rawProductText);
  if (normalizedRawProductText) return `${report.storeId}:raw:${normalizedRawProductText}`;
  return `${report.storeId}:raw-missing:${report.id}`;
}

function normalizeRawProductText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function isTimelineUpdateStatus(status: ReportUpdateStatus): status is Exclude<ReportUpdateStatus, "incorrect"> {
  return status === "still_there" || status === "gone" || status === "restocked";
}

function isPositiveEvent(event: EvidenceTimelineEvent) {
  return event.type === "initial_sighting" || event.type === "still_there" || event.type === "restocked";
}

function isNegativeEvent(event: EvidenceTimelineEvent) {
  return event.type === "gone";
}

function updateLabel(status: ReportUpdateStatus) {
  if (status === "still_there") return "Still reported there";
  if (status === "gone") return "Reported gone";
  if (status === "restocked") return "Restock reported";
  return "Update reported";
}

function compareCreatedAtAsc(left: EnrichedReport, right: EnrichedReport) {
  return Date.parse(left.createdAt) - Date.parse(right.createdAt);
}

function compareTimelineEventsAsc(left: EvidenceTimelineEvent, right: EvidenceTimelineEvent) {
  return Date.parse(left.createdAt) - Date.parse(right.createdAt);
}

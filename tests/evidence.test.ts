import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEvidenceSummaries } from "../app/lib/evidence";
import type { EnrichedReport, Product, ReportUpdateStatus, Store } from "../app/lib/types";

const now = new Date("2026-06-15T16:00:00.000Z");

test("one fresh report is recently_seen", () => {
  const [summary] = buildEvidenceSummaries([
    report({ id: "report-1", createdAt: "2026-06-15T15:30:00.000Z", createdBy: "anon_reporter_a" })
  ], { now });

  assert.equal(summary.evidenceStatus, "recently_seen");
  assert.equal(summary.initialReportCount, 1);
  assert.equal(summary.positiveCount, 1);
});

test("two distinct contributors confirming is likely_in_stock", () => {
  const [summary] = buildEvidenceSummaries([
    report({
      id: "report-1",
      createdAt: "2026-06-15T15:00:00.000Z",
      createdBy: "anon_reporter_a",
      updates: [
        update("update-1", "report-1", "still_there", "2026-06-15T15:20:00.000Z", "anon_reporter_b")
      ]
    })
  ], { now });

  assert.equal(summary.evidenceStatus, "likely_in_stock");
  assert.equal(summary.confirmationCount, 1);
  assert.equal(summary.distinctContributorCount, 2);
});

test("gone after positive is likely_gone", () => {
  const [summary] = buildEvidenceSummaries([
    report({
      id: "report-1",
      createdAt: "2026-06-15T14:00:00.000Z",
      createdBy: "anon_reporter_a",
      updates: [
        update("update-1", "report-1", "gone", "2026-06-15T15:00:00.000Z", "anon_reporter_b")
      ]
    })
  ], { now });

  assert.equal(summary.evidenceStatus, "likely_gone");
  assert.equal(summary.negativeCount, 1);
});

test("recent positive and negative current signals are mixed_reports", () => {
  const summaries = buildEvidenceSummaries([
    report({ id: "report-1", createdAt: "2026-06-15T14:00:00.000Z", createdBy: "anon_reporter_a" }),
    report({
      id: "report-2",
      createdAt: "2026-06-15T14:30:00.000Z",
      createdBy: "anon_reporter_b",
      updates: [
        update("update-1", "report-2", "gone", "2026-06-15T15:00:00.000Z", "anon_reporter_c")
      ]
    })
  ], { now });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].evidenceStatus, "mixed_reports");
});

test("activity older than 24 hours is stale", () => {
  const [summary] = buildEvidenceSummaries([
    report({ id: "report-1", createdAt: "2026-06-14T15:59:00.000Z", createdBy: "anon_reporter_a" })
  ], { now });

  assert.equal(summary.evidenceStatus, "stale");
});

test("restocked after gone becomes positive again", () => {
  const [summary] = buildEvidenceSummaries([
    report({
      id: "report-1",
      createdAt: "2026-06-15T13:00:00.000Z",
      createdBy: "anon_reporter_a",
      updates: [
        update("update-1", "report-1", "gone", "2026-06-15T14:00:00.000Z", "anon_reporter_b"),
        update("update-2", "report-1", "restocked", "2026-06-15T15:00:00.000Z", "anon_reporter_a")
      ]
    })
  ], { now });

  assert.equal(summary.evidenceStatus, "likely_in_stock");
  assert.equal(summary.restockCount, 1);
  assert.equal(summary.lastPositiveAt, "2026-06-15T15:00:00.000Z");
});

test("same contributor repeated confirmations do not increase distinctContributorCount", () => {
  const [summary] = buildEvidenceSummaries([
    report({
      id: "report-1",
      createdAt: "2026-06-15T13:00:00.000Z",
      createdBy: "anon_reporter_a",
      updates: [
        update("update-1", "report-1", "still_there", "2026-06-15T14:00:00.000Z", "anon_reporter_a"),
        update("update-2", "report-1", "still_there", "2026-06-15T15:00:00.000Z", "anon_reporter_a")
      ]
    })
  ], { now });

  assert.equal(summary.confirmationCount, 2);
  assert.equal(summary.distinctContributorCount, 1);
});

test("timeline includes initial reports and updates in correct order", () => {
  const [summary] = buildEvidenceSummaries([
    report({
      id: "report-1",
      createdAt: "2026-06-15T13:00:00.000Z",
      createdBy: "anon_reporter_a",
      updates: [
        update("update-2", "report-1", "restocked", "2026-06-15T15:00:00.000Z", "anon_reporter_c"),
        update("update-1", "report-1", "gone", "2026-06-15T14:00:00.000Z", "anon_reporter_b")
      ]
    })
  ], { now });

  assert.deepEqual(summary.timelineEvents.map((event) => event.type), [
    "initial_sighting",
    "gone",
    "restocked"
  ]);
  assert.deepEqual(summary.timelineEvents.map((event) => event.reportUpdateId), [
    null,
    "update-1",
    "update-2"
  ]);
});

test("matched products group by store and product id", () => {
  const summaries = buildEvidenceSummaries([
    report({ id: "report-1", createdAt: "2026-06-15T13:00:00.000Z", createdBy: "anon_reporter_a" }),
    report({ id: "report-2", createdAt: "2026-06-15T14:00:00.000Z", createdBy: "anon_reporter_b" })
  ], { now });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].evidenceKey, "store-1:product:product-1");
  assert.equal(summaries[0].initialReportCount, 2);
});

test("unmatched products group by store and normalized raw product text", () => {
  const summaries = buildEvidenceSummaries([
    report({
      id: "report-1",
      createdAt: "2026-06-15T13:00:00.000Z",
      createdBy: "anon_reporter_a",
      productId: null,
      product: null,
      rawProductText: " Mystery Tin! "
    }),
    report({
      id: "report-2",
      createdAt: "2026-06-15T14:00:00.000Z",
      createdBy: "anon_reporter_b",
      productId: null,
      product: null,
      rawProductText: "mystery tin"
    })
  ], { now });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].evidenceKey, "store-1:raw:mystery-tin");
  assert.equal(summaries[0].initialReportCount, 2);
});

test("blank unmatched product text does not collapse unrelated reports", () => {
  const summaries = buildEvidenceSummaries([
    report({
      id: "report-1",
      createdAt: "2026-06-15T13:00:00.000Z",
      createdBy: "anon_reporter_a",
      productId: null,
      product: null,
      rawProductText: ""
    }),
    report({
      id: "report-2",
      createdAt: "2026-06-15T14:00:00.000Z",
      createdBy: "anon_reporter_b",
      productId: null,
      product: null,
      rawProductText: null
    })
  ], { now });

  assert.equal(summaries.length, 2);
  assert.deepEqual(summaries.map((summary) => summary.evidenceKey).sort(), [
    "store-1:raw-missing:report-1",
    "store-1:raw-missing:report-2"
  ]);
});

test("matched product id and unmatched raw fallback do not merge", () => {
  const summaries = buildEvidenceSummaries([
    report({ id: "report-1", createdAt: "2026-06-15T13:00:00.000Z", createdBy: "anon_reporter_a" }),
    report({
      id: "report-2",
      createdAt: "2026-06-15T14:00:00.000Z",
      createdBy: "anon_reporter_b",
      productId: null,
      product: null,
      rawProductText: "product 1"
    })
  ], { now });

  assert.equal(summaries.length, 2);
  assert.equal(summaries.some((summary) => summary.evidenceKey === "store-1:product:product-1"), true);
  assert.equal(summaries.some((summary) => summary.evidenceKey === "store-1:raw:product-1"), true);
});

function report(input: {
  id: string;
  createdAt: string;
  createdBy: string;
  updates?: EnrichedReport["updates"];
  productId?: string | null;
  product?: Product | null;
  rawProductText?: string | null;
}): EnrichedReport {
  return {
    id: input.id,
    storeId: store.id,
    productId: input.productId === undefined ? product.id : input.productId,
    rawProductText: input.rawProductText === undefined ? "151 booster bundle" : input.rawProductText,
    rawPrice: null,
    quantityObserved: null,
    status: "in_stock",
    photoUrl: null,
    source: "user",
    matchConfidence: 1,
    matchMethod: "exact_name",
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    expiresAt: null,
    store,
    product: input.product === undefined ? product : input.product,
    updates: input.updates ?? []
  };
}

function update(
  id: string,
  reportId: string,
  status: ReportUpdateStatus,
  createdAt: string,
  createdBy: string
) {
  return { id, reportId, status, createdAt, createdBy };
}

const store: Store = {
  id: "store-1",
  name: "Target",
  retailerType: "target",
  address: "1 Test Way",
  latitude: 42.7,
  longitude: -73.8,
  placeId: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

const product: Product = {
  id: "product-1",
  canonicalName: "Pokemon 151 Booster Bundle",
  setName: "Scarlet & Violet 151",
  productType: "booster_bundle",
  imageUrl: null,
  active: true,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createReport,
  createReportUpdate,
  getAdminSnapshot,
  getSnapshot,
  resetPrismaDb,
  resolveUnmatchedReport
} from "../app/lib/data";

const hasDatabase = Boolean(
  process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL
);

test("unknown report creates both a Report and an UnmatchedReport", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "totally unknown shelf box",
    status: "unknown",
    createdBy: "anon_test_reporter"
  });

  const admin = await getAdminSnapshot();
  const unmatched = admin.unmatchedReports.find((candidate) => candidate.reportId === report.id);

  assert.equal(report.productId, null);
  assert.equal(report.createdBy, "anon_test_reporter");
  assert.ok(unmatched);
  assert.equal(unmatched?.adminStatus, "pending");
});

test("matched report creation stores contributor ID", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "151 booster bundle",
    status: "in_stock",
    createdBy: "anon_same_browser"
  });

  assert.equal(report.productId, "product-002");
  assert.equal(report.createdBy, "anon_same_browser");
});

test("report update stores contributor ID", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "151 booster bundle",
    status: "in_stock",
    createdBy: "anon_original_browser"
  });

  const result = await createReportUpdate({
    reportId: report.id,
    status: "still_there",
    createdBy: "anon_same_browser"
  });

  assert.equal(result.changed, true);
  assert.equal(result.update?.createdBy, "anon_same_browser");
});

test("duplicate gone does not create extra ReportUpdate", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "151 booster bundle",
    status: "in_stock",
    createdBy: "anon_reporter_a"
  });

  const first = await createReportUpdate({
    reportId: report.id,
    status: "gone",
    createdBy: "anon_reporter_b"
  });
  const second = await createReportUpdate({
    reportId: report.id,
    status: "gone",
    createdBy: "anon_reporter_c"
  });
  const snapshot = await getSnapshot();
  const updatedReport = snapshot.reports.find((candidate) => candidate.id === report.id);

  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(second.reason, "already_sold_out");
  assert.equal(updatedReport?.updates.length, 1);
});

test("duplicate still_there within cooldown does not create extra ReportUpdate", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "151 booster bundle",
    status: "in_stock",
    createdBy: "anon_reporter_a"
  });

  const first = await createReportUpdate({
    reportId: report.id,
    status: "still_there",
    createdBy: "anon_reporter_b"
  });
  const second = await createReportUpdate({
    reportId: report.id,
    status: "still_there",
    createdBy: "anon_reporter_b"
  });
  const snapshot = await getSnapshot();
  const updatedReport = snapshot.reports.find((candidate) => candidate.id === report.id);

  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(second.reason, "duplicate_update_cooldown");
  assert.equal(updatedReport?.updates.length, 1);
});

test("still_there immediately after own report is no-op", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "151 booster bundle",
    status: "in_stock",
    createdBy: "anon_same_browser"
  });

  const result = await createReportUpdate({
    reportId: report.id,
    status: "still_there",
    createdBy: "anon_same_browser"
  });
  const snapshot = await getSnapshot();
  const updatedReport = snapshot.reports.find((candidate) => candidate.id === report.id);

  assert.equal(result.changed, false);
  assert.equal(result.reason, "own_report_confirmation_cooldown");
  assert.equal(updatedReport?.updates.length, 0);
});

test("restocked after sold_out updates report status to in_stock", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "151 booster bundle",
    status: "sold_out",
    createdBy: "anon_reporter_a"
  });

  const result = await createReportUpdate({
    reportId: report.id,
    status: "restocked",
    createdBy: "anon_reporter_b"
  });
  const snapshot = await getSnapshot();
  const updatedReport = snapshot.reports.find((candidate) => candidate.id === report.id);

  assert.equal(result.changed, true);
  assert.equal(updatedReport?.status, "in_stock");
});

test("admin matching attaches product without saving alias by default", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "dragon display on endcap",
    status: "unknown",
    createdBy: "anon_admin_case"
  });
  const admin = await getAdminSnapshot();
  const unmatched = admin.unmatchedReports.find((candidate) => candidate.reportId === report.id);
  assert.ok(unmatched);

  await resolveUnmatchedReport({
    unmatchedReportId: unmatched.id,
    productId: "product-002",
    adminStatus: "matched",
    alias: "dragon display on endcap",
    saveAlias: false
  });

  const snapshot = await getSnapshot();
  const attached = snapshot.reports.find((candidate) => candidate.id === report.id);
  assert.equal(attached?.productId, "product-002");

  const newReport = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "dragon display on endcap",
    status: "unknown",
    createdBy: "anon_admin_case"
  });
  assert.equal(newReport.productId, null);
});

test("admin matching can explicitly save an alias for future matching", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "clean 151 bundle nickname",
    status: "unknown",
    createdBy: "anon_alias_case"
  });
  const admin = await getAdminSnapshot();
  const unmatched = admin.unmatchedReports.find((candidate) => candidate.reportId === report.id);
  assert.ok(unmatched);

  await resolveUnmatchedReport({
    unmatchedReportId: unmatched.id,
    productId: "product-002",
    adminStatus: "matched",
    alias: "clean 151 bundle nickname",
    saveAlias: true
  });

  const newReport = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "clean 151 bundle nickname",
    status: "in_stock",
    createdBy: "anon_alias_case"
  });
  assert.equal(newReport.productId, "product-002");
});

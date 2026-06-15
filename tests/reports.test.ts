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
    createdBy: "anon_same_browser"
  });

  const update = await createReportUpdate({
    reportId: report.id,
    status: "still_there",
    createdBy: "anon_same_browser"
  });

  assert.equal(update.createdBy, "anon_same_browser");
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

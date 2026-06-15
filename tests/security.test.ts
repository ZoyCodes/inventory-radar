import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as adminSessionPost } from "../app/api/admin/session/route";
import { GET as adminGet, PATCH as adminPatch } from "../app/api/admin/unmatched/route";
import { POST as reportPost } from "../app/api/reports/route";
import { POST as updatePost } from "../app/api/report-updates/route";
import { createReport, getAdminSnapshot, resetPrismaDb } from "../app/lib/data";
import { resetRateLimitsForTests } from "../app/lib/rate-limit";

const adminToken = "test_admin_token_12345678901234567890";

process.env.ADMIN_TOKEN = adminToken;
const hasDatabase = Boolean(
  process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL
);

test("GET /api/admin/unmatched rejects unauthenticated requests", async () => {
  const response = await adminGet(new Request("http://localhost/api/admin/unmatched"));

  assert.equal(response.status, 401);
});

test("PATCH /api/admin/unmatched rejects wrong token", async () => {
  const response = await adminPatch(
    jsonRequest("http://localhost/api/admin/unmatched", {
      unmatchedReportId: "unmatched-001",
      adminStatus: "ignored"
    }, "Bearer wrong-token")
  );

  assert.equal(response.status, 401);
});

test("admin login sets an HTTP-only Strict cookie and rate limits attempts", async () => {
  resetRateLimitsForTests();

  const login = await adminSessionPost(
    jsonRequest("http://localhost/api/admin/session", { token: adminToken })
  );
  const cookie = login.headers.get("set-cookie") ?? "";

  assert.equal(login.status, 200);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=28800/);

  const statuses: number[] = [];
  for (let index = 0; index < 11; index += 1) {
    const response = await adminSessionPost(
      jsonRequest("http://localhost/api/admin/session", { token: "wrong-token" })
    );
    statuses.push(response.status);
  }

  assert.equal(statuses.slice(0, 9).every((status) => status === 401), true);
  assert.equal(statuses.at(-1), 429);
});

test("cookie-authenticated admin mutation rejects cross-origin requests", async () => {
  const response = await adminPatch(
    jsonRequest(
      "http://localhost/api/admin/unmatched",
      {
        unmatchedReportId: "unmatched-001",
        adminStatus: "ignored"
      },
      undefined,
      {
        cookie: `inventory_radar_admin=${adminToken}`,
        origin: "https://evil.example"
      }
    )
  );

  assert.equal(response.status, 403);
});

test("GET /api/admin/unmatched accepts correct bearer token", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();

  const response = await adminGet(
    new Request("http://localhost/api/admin/unmatched", {
      headers: { authorization: `Bearer ${adminToken}` }
    })
  );

  assert.equal(response.status, 200);
});

test("public report rejects mass-assignment fields", async () => {
  resetRateLimitsForTests();

  const response = await reportPost(
    jsonRequest("http://localhost/api/reports", {
      storeId: "store-target-colonie",
      rawProductText: "151 booster bundle",
      status: "in_stock",
      source: "admin"
    })
  );

  assert.equal(response.status, 400);
});

test("public report rejects unsafe photo URLs and huge strings", async () => {
  resetRateLimitsForTests();

  const badUrl = await reportPost(
    jsonRequest("http://localhost/api/reports", {
      storeId: "store-target-colonie",
      rawProductText: "151 booster bundle",
      status: "in_stock",
      photoUrl: "javascript:alert(1)"
    })
  );
  assert.equal(badUrl.status, 400);

  const hugeText = await reportPost(
    jsonRequest("http://localhost/api/reports", {
      storeId: "store-target-colonie",
      rawProductText: "x".repeat(161),
      status: "in_stock"
    })
  );
  assert.equal(hugeText.status, 400);
});

test("public report cleans XSS payloads into inert stored text", { skip: !hasDatabase }, async () => {
  resetRateLimitsForTests();
  await resetPrismaDb();

  const response = await reportPost(
    jsonRequest("http://localhost/api/reports", {
      storeId: "store-target-colonie",
      rawProductText: "<img src=x onerror=alert(1)>",
      status: "unknown",
      createdBy: "anon_security_test"
    })
  );
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.rawProductText, "<img src=x onerror=alert(1)>");
  assert.equal(body.productId, null);
});

test("public report rejects invalid IDs and bad quantities", { skip: !hasDatabase }, async () => {
  resetRateLimitsForTests();

  const invalidStore = await reportPost(
    jsonRequest("http://localhost/api/reports", {
      storeId: "missing-store",
      rawProductText: "151 booster bundle",
      status: "in_stock"
    })
  );
  assert.equal(invalidStore.status, 404);

  const badQuantity = await reportPost(
    jsonRequest("http://localhost/api/reports", {
      storeId: "store-target-colonie",
      rawProductText: "151 booster bundle",
      status: "in_stock",
      quantityObserved: -1
    })
  );
  assert.equal(badQuantity.status, 400);
});

test("public report creation rate limits obvious spam", { skip: !hasDatabase }, async () => {
  resetRateLimitsForTests();
  await resetPrismaDb();

  const statuses: number[] = [];
  for (let index = 0; index < 11; index += 1) {
    const response = await reportPost(
      jsonRequest("http://localhost/api/reports", {
        storeId: "store-target-colonie",
        rawProductText: `unknown spam box ${index}`,
        status: "unknown",
        createdBy: "anon_rate_limit_test"
      })
    );
    statuses.push(response.status);
  }

  assert.equal(statuses.slice(0, 10).every((status) => status === 201), true);
  assert.equal(statuses[10], 429);
});

test("public report updates reject bad payloads and rate limit spam", { skip: !hasDatabase }, async () => {
  resetRateLimitsForTests();
  await resetPrismaDb();

  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "151 booster bundle",
    status: "in_stock",
    createdBy: "anon_update_limit"
  });

  const massAssignment = await updatePost(
    jsonRequest("http://localhost/api/report-updates", {
      reportId: report.id,
      status: "still_there",
      createdAt: "2001-01-01T00:00:00.000Z"
    })
  );
  assert.equal(massAssignment.status, 400);

  const statuses: number[] = [];
  for (let index = 0; index < 31; index += 1) {
    const response = await updatePost(
      jsonRequest("http://localhost/api/report-updates", {
        reportId: report.id,
        status: "still_there",
        createdBy: "anon_update_limit"
      })
    );
    statuses.push(response.status);
  }

  assert.equal(statuses.slice(0, 30).every((status) => status === 201), true);
  assert.equal(statuses[30], 429);
});

test("admin alias creation rejects generic aliases", { skip: !hasDatabase }, async () => {
  await resetPrismaDb();
  const report = await createReport({
    storeId: "store-target-colonie",
    rawProductText: "new dragon box by electronics",
    status: "unknown",
    createdBy: "anon_security_admin"
  });
  const admin = await getAdminSnapshot();
  const unmatched = admin.unmatchedReports.find((candidate) => candidate.reportId === report.id);
  assert.ok(unmatched);

  const response = await adminPatch(
    jsonRequest("http://localhost/api/admin/unmatched", {
      unmatchedReportId: unmatched.id,
      adminStatus: "matched",
      productId: "product-002",
      alias: "pokemon",
      saveAlias: true
    }, `Bearer ${adminToken}`)
  );

  assert.equal(response.status, 400);
});

function jsonRequest(
  url: string,
  body: Record<string, unknown>,
  authorization?: string,
  extraHeaders?: Record<string, string>
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": "203.0.113.10",
    ...extraHeaders
  };
  if (authorization) headers.authorization = authorization;

  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

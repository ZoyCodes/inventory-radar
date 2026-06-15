import assert from "node:assert/strict";
import { test } from "node:test";
import { matchProduct } from "../app/lib/matching";
import { seedDb } from "../app/lib/seed";
import type { InventoryDb } from "../app/lib/types";

test("exact UPC match returns the correct product", () => {
  const db = withIdentifiers([
    {
      id: "test-upc",
      productId: "product-002",
      type: "upc",
      value: "0820650855190",
      source: "test",
      createdAt: new Date().toISOString()
    }
  ]);

  assert.deepEqual(matchProduct(db, { upc: "0820650855190" }), {
    productId: "product-002",
    confidence: 1,
    method: "exact_upc"
  });
});

test("exact retailer SKU match returns the correct product", () => {
  const db = withIdentifiers([
    {
      id: "test-sku",
      productId: "product-017",
      type: "retailer_sku",
      value: "PE-ETB-001",
      source: "test",
      createdAt: new Date().toISOString()
    }
  ]);

  assert.deepEqual(matchProduct(db, { retailerSku: "pe-etb-001" }), {
    productId: "product-017",
    confidence: 1,
    method: "exact_retailer_sku"
  });
});

test("exact alias match returns the correct product", () => {
  const result = matchProduct(seedDb, { rawProductText: "151 booster bundle" });

  assert.equal(result.productId, "product-002");
  assert.equal(result.method, "exact_name");
});

test("normalized casing and punctuation differences still match", () => {
  const result = matchProduct(seedDb, { rawProductText: "Pokemon 151 ETB!!!" });

  assert.equal(result.productId, "product-001");
  assert.equal(result.method, "exact_name");
});

test("fuzzy match works for obvious near matches", () => {
  const result = matchProduct(seedDb, { rawProductText: "prismatic evolution elite trainer" });

  assert.equal(result.productId, "product-017");
  assert.equal(result.method, "fuzzy_name");
});

test("low-confidence unknown input returns no product match", () => {
  const result = matchProduct(seedDb, { rawProductText: "blue mystery thing near checkout" });

  assert.equal(result.productId, null);
  assert.equal(result.method, "unmatched");
});

test("generic product terms do not over-match", () => {
  const result = matchProduct(seedDb, { rawProductText: "pokemon cards box" });

  assert.equal(result.productId, null);
  assert.equal(result.method, "unmatched");
});

function withIdentifiers(identifiers: InventoryDb["productIdentifiers"]): InventoryDb {
  const db = structuredClone(seedDb);
  db.productIdentifiers.push(...identifiers);
  return db;
}

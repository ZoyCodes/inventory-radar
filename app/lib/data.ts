import { Prisma } from "@prisma/client";
import { buildEvidenceSummaries, type EvidenceSummary } from "./evidence";
import { matchProduct } from "./matching";
import { prisma } from "./prisma";
import { cleanAlias, RequestValidationError } from "./request-validation";
import { seedDb } from "./seed";
import { assertProductionGuardrails } from "./security";
import type {
  AdminStatus,
  EnrichedReport,
  InventoryDb,
  Product,
  ProductIdentifier,
  Report,
  ReportStatus,
  ReportUpdate,
  ReportUpdateStatus,
  Store,
  UnmatchedReport
} from "./types";

assertProductionGuardrails();

export type Snapshot = {
  stores: Store[];
  products: Product[];
  reports: EnrichedReport[];
  recentReports: EnrichedReport[];
  evidenceSummaries: EvidenceSummary[];
  unmatchedCount: number;
  metrics: {
    reportsSubmitted: number;
    uniqueContributors: number;
    repeatContributors: number;
    storeUpdates: number;
    dailyActiveViewers: number;
    reportsPerActiveUser: number;
  };
};

type PrismaReportWithRelations = Prisma.ReportGetPayload<{
  include: {
    store: true;
    product: true;
    updates: true;
  };
}>;

export async function getSnapshot(): Promise<Snapshot> {
  const [stores, products, reports, unmatchedCount, metrics] = await Promise.all([
    prisma.store.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { canonicalName: "asc" } }),
    prisma.report.findMany({
      include: {
        store: true,
        product: true,
        updates: { orderBy: { createdAt: "desc" } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.unmatchedReport.count({ where: { adminStatus: "pending" } }),
    getMetricCounts()
  ]);

  const enrichedReports = reports.map(toEnrichedReport);
  const evidenceSummaries = buildEvidenceSummaries(enrichedReports);

  return {
    stores: stores.map(toStore),
    products: products.map(toProduct),
    reports: enrichedReports,
    recentReports: enrichedReports.slice(0, 20),
    evidenceSummaries,
    unmatchedCount,
    metrics
  };
}

export async function getAdminSnapshot() {
  const [products, unmatchedReports] = await prisma.$transaction([
    prisma.product.findMany({ where: { active: true }, orderBy: { canonicalName: "asc" } }),
    prisma.unmatchedReport.findMany({
      include: {
        report: { include: { store: true } },
        matchedProduct: true
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return {
    products: products.map(toProduct),
    unmatchedReports: unmatchedReports.map((unmatched) => ({
      ...toUnmatchedReport(unmatched),
      report: unmatched.report ? toReport(unmatched.report) : null,
      store: unmatched.report?.store ? toStore(unmatched.report.store) : null,
      matchedProduct: unmatched.matchedProduct ? toProduct(unmatched.matchedProduct) : null
    }))
  };
}

export async function createReport(input: {
  storeId: string;
  rawProductText: string;
  rawPrice?: string | null;
  quantityObserved?: number | null;
  status: ReportStatus;
  photoUrl?: string | null;
  upc?: string | null;
  retailerSku?: string | null;
  createdBy?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({ where: { id: input.storeId } });
    if (!store) throw new RequestValidationError("Store not found.", 404);

    const [products, productIdentifiers] = await Promise.all([
      tx.product.findMany({ where: { active: true } }),
      tx.productIdentifier.findMany()
    ]);
    const match = matchProduct(toMatchingDb(products.map(toProduct), productIdentifiers.map(toProductIdentifier)), {
      rawProductText: input.rawProductText,
      upc: input.upc,
      retailerSku: input.retailerSku
    });

    const report = await tx.report.create({
      data: {
        storeId: input.storeId,
        productId: match.productId,
        rawProductText: input.rawProductText.trim(),
        rawPrice: input.rawPrice?.trim() || null,
        quantityObserved: input.quantityObserved ?? null,
        status: input.status,
        photoUrl: input.photoUrl || null,
        source: "user",
        matchConfidence: match.confidence,
        matchMethod: match.method,
        createdBy: normalizeContributorId(input.createdBy),
        unmatchedReport:
          !match.productId && input.rawProductText.trim()
            ? {
                create: {
                  rawProductText: input.rawProductText.trim(),
                  photoUrl: input.photoUrl || null,
                  adminStatus: "pending"
                }
              }
            : undefined
      },
      include: {
        store: true,
        product: true,
        updates: { orderBy: { createdAt: "desc" } }
      }
    });

    return toEnrichedReport(report);
  });
}

export async function createReportUpdate(input: {
  reportId: string;
  status: ReportUpdateStatus;
  createdBy?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const createdBy = normalizeContributorId(input.createdBy);
    const now = new Date();
    const cooldownStart = new Date(now.getTime() - 30 * 60 * 1000);
    const report = await tx.report.findUnique({
      where: { id: input.reportId },
      include: {
        updates: {
          where: {
            createdBy,
            status: input.status,
            createdAt: { gte: cooldownStart }
          },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
    if (!report) throw new RequestValidationError("Report not found.", 404);

    if (
      input.status === "still_there"
      && report.createdBy === createdBy
      && report.createdAt >= cooldownStart
    ) {
      return {
        changed: false,
        update: null,
        reason: "own_report_confirmation_cooldown" as const
      };
    }

    if (report.updates.length > 0) {
      return {
        changed: false,
        update: null,
        reason: "duplicate_update_cooldown" as const
      };
    }

    if (report.status === "sold_out" && input.status === "gone") {
      return {
        changed: false,
        update: null,
        reason: "already_sold_out" as const
      };
    }

    if (report.status === "sold_out" && input.status === "still_there") {
      return {
        changed: false,
        update: null,
        reason: "sold_out_confirmation_blocked" as const
      };
    }

    const update = await tx.reportUpdate.create({
      data: {
        reportId: input.reportId,
        status: input.status,
        createdBy
      }
    });

    if (input.status === "gone" || input.status === "restocked") {
      await tx.report.update({
        where: { id: input.reportId },
        data: { status: input.status === "gone" ? "sold_out" : "in_stock" }
      });
    }

    return {
      changed: true,
      update: toReportUpdate(update),
      reason: null
    };
  });
}

export async function resolveUnmatchedReport(input: {
  unmatchedReportId: string;
  productId?: string | null;
  alias?: string | null;
  adminStatus: AdminStatus;
  saveAlias?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const unmatched = await tx.unmatchedReport.findUnique({
      where: { id: input.unmatchedReportId }
    });
    if (!unmatched) throw new RequestValidationError("Unmatched report not found.", 404);

    if (input.adminStatus === "matched" && input.productId) {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product) throw new RequestValidationError("Product not found.", 404);

      await tx.report.update({
        where: { id: unmatched.reportId },
        data: {
          productId: input.productId,
          matchConfidence: 1,
          matchMethod: "admin_match"
        }
      });

      if (input.saveAlias) {
        const alias = cleanAlias(input.alias?.trim() || unmatched.rawProductText.trim());
        if (alias) {
          await createProductAlias(tx, input.productId, alias);
        }
      }
    }

    const updated = await tx.unmatchedReport.update({
      where: { id: input.unmatchedReportId },
      data: {
        adminStatus: input.adminStatus,
        matchedProductId:
          input.adminStatus === "matched" && input.productId ? input.productId : undefined
      }
    });

    return toUnmatchedReport(updated);
  });
}

export async function resetPrismaDb() {
  await prisma.$transaction(async (tx) => {
    await tx.unmatchedReport.deleteMany();
    await tx.reportUpdate.deleteMany();
    await tx.report.deleteMany();
    await tx.productIdentifier.deleteMany();
    await tx.product.deleteMany();
    await tx.store.deleteMany();

    for (const store of seedDb.stores) {
      await tx.store.create({
        data: {
          id: store.id,
          name: store.name,
          retailerType: store.retailerType,
          address: store.address,
          latitude: store.latitude,
          longitude: store.longitude,
          placeId: store.placeId
        }
      });
    }

    for (const product of seedDb.products) {
      await tx.product.create({
        data: {
          id: product.id,
          canonicalName: product.canonicalName,
          setName: product.setName,
          productType: product.productType,
          imageUrl: product.imageUrl,
          active: product.active
        }
      });
    }

    for (const identifier of seedDb.productIdentifiers) {
      await tx.productIdentifier.create({
        data: {
          id: identifier.id,
          productId: identifier.productId,
          type: identifier.type,
          value: identifier.value,
          source: identifier.source
        }
      });
    }
  });
}

async function createProductAlias(
  tx: Prisma.TransactionClient,
  productId: string,
  alias: string
) {
  const existing = await tx.productIdentifier.findFirst({
    where: {
      type: "alias",
      value: { equals: alias, mode: "insensitive" }
    }
  });
  if (existing) throw new RequestValidationError("Alias already exists.", 409);

  try {
    await tx.productIdentifier.create({
      data: {
        productId,
        type: "alias",
        value: alias,
        source: "admin"
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new RequestValidationError("Alias already exists.", 409);
    }
    throw error;
  }
}

function getMetricCounts() {
  return prisma.$queryRaw<
    Array<{
      reports_submitted: bigint;
      unique_contributors: bigint;
      repeat_contributors: bigint;
      store_updates: bigint;
    }>
  >`
    SELECT
      (SELECT COUNT(*) FROM "Report") AS reports_submitted,
      (SELECT COUNT(DISTINCT "createdBy") FROM "Report" WHERE "createdBy" IS NOT NULL) AS unique_contributors,
      (
        SELECT COUNT(*) FROM (
          SELECT "createdBy"
          FROM "Report"
          WHERE "createdBy" IS NOT NULL
          GROUP BY "createdBy"
          HAVING COUNT(*) > 1
        ) repeat_users
      ) AS repeat_contributors,
      (SELECT COUNT(*) FROM "ReportUpdate") AS store_updates
  `.then((rows) => {
    const row = rows[0];
    const reportsSubmitted = Number(row?.reports_submitted ?? 0);
    const uniqueContributors = Number(row?.unique_contributors ?? 0);
    const repeatContributors = Number(row?.repeat_contributors ?? 0);
    const storeUpdates = Number(row?.store_updates ?? 0);
    const activeUsers = Math.max(uniqueContributors, 1);

    return {
      reportsSubmitted,
      uniqueContributors,
      repeatContributors,
      storeUpdates,
      dailyActiveViewers: activeUsers,
      reportsPerActiveUser: Number((reportsSubmitted / activeUsers).toFixed(1))
    };
  });
}

function toMatchingDb(products: Product[], productIdentifiers: ProductIdentifier[]): InventoryDb {
  return {
    stores: [],
    products,
    productIdentifiers,
    reports: [],
    reportUpdates: [],
    unmatchedReports: []
  };
}

function toEnrichedReport(report: PrismaReportWithRelations): EnrichedReport {
  return {
    ...toReport(report),
    store: toStore(report.store),
    product: report.product ? toProduct(report.product) : null,
    updates: report.updates.map(toReportUpdate)
  };
}

function toStore(store: {
  id: string;
  name: string;
  retailerType: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Store {
  return {
    ...store,
    retailerType: store.retailerType as Store["retailerType"],
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString()
  };
}

function toProduct(product: {
  id: string;
  canonicalName: string;
  setName: string | null;
  productType: string;
  imageUrl: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Product {
  return {
    ...product,
    productType: product.productType as Product["productType"],
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

function toProductIdentifier(identifier: {
  id: string;
  productId: string;
  type: string;
  value: string;
  source: string | null;
  createdAt: Date;
}): ProductIdentifier {
  return {
    ...identifier,
    type: identifier.type as ProductIdentifier["type"],
    createdAt: identifier.createdAt.toISOString()
  };
}

function toReport(report: {
  id: string;
  storeId: string;
  productId: string | null;
  rawProductText: string | null;
  rawPrice: string | null;
  quantityObserved: number | null;
  status: string;
  photoUrl: string | null;
  source: string;
  matchConfidence: number | null;
  matchMethod: string | null;
  createdBy: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}): Report {
  return {
    ...report,
    status: report.status as Report["status"],
    source: report.source as Report["source"],
    createdAt: report.createdAt.toISOString(),
    expiresAt: report.expiresAt?.toISOString() ?? null
  };
}

function toReportUpdate(update: {
  id: string;
  reportId: string;
  status: string;
  createdBy: string | null;
  createdAt: Date;
}): ReportUpdate {
  return {
    ...update,
    status: update.status as ReportUpdate["status"],
    createdAt: update.createdAt.toISOString()
  };
}

function toUnmatchedReport(unmatched: {
  id: string;
  reportId: string;
  rawProductText: string;
  photoUrl: string | null;
  adminStatus: string;
  matchedProductId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UnmatchedReport {
  return {
    ...unmatched,
    adminStatus: unmatched.adminStatus as UnmatchedReport["adminStatus"],
    createdAt: unmatched.createdAt.toISOString(),
    updatedAt: unmatched.updatedAt.toISOString()
  };
}

function normalizeContributorId(value?: string | null) {
  const trimmed = value?.trim();
  if (trimmed && /^anon_[a-zA-Z0-9_-]{8,80}$/.test(trimmed)) return trimmed;
  return "anonymous-local";
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

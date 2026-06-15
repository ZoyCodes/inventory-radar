-- CreateEnum
CREATE TYPE "RetailerType" AS ENUM ('target', 'walmart', 'cvs', 'walgreens', 'gamestop', 'local_card_shop', 'other');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('etb', 'booster_bundle', 'booster_box', 'collection_box', 'tin', 'mini_tin', 'blister', 'other');

-- CreateEnum
CREATE TYPE "ProductIdentifierType" AS ENUM ('upc', 'retailer_sku', 'alias', 'normalized_name', 'retailer_url');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('in_stock', 'low_stock', 'sold_out', 'unknown');

-- CreateEnum
CREATE TYPE "ReportSource" AS ENUM ('user', 'scraper', 'admin');

-- CreateEnum
CREATE TYPE "ReportUpdateStatus" AS ENUM ('still_there', 'gone', 'restocked', 'incorrect');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('pending', 'matched', 'ignored');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "retailerType" "RetailerType" NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "placeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "setName" TEXT,
    "productType" "ProductType" NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductIdentifier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "ProductIdentifierType" NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT,
    "rawProductText" TEXT,
    "rawPrice" TEXT,
    "quantityObserved" INTEGER,
    "status" "ReportStatus" NOT NULL,
    "photoUrl" TEXT,
    "source" "ReportSource" NOT NULL DEFAULT 'user',
    "matchConfidence" DOUBLE PRECISION,
    "matchMethod" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportUpdate" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" "ReportUpdateStatus" NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmatchedReport" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "rawProductText" TEXT NOT NULL,
    "photoUrl" TEXT,
    "adminStatus" "AdminStatus" NOT NULL DEFAULT 'pending',
    "matchedProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnmatchedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Store_latitude_longitude_idx" ON "Store"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Store_retailerType_idx" ON "Store"("retailerType");

-- CreateIndex
CREATE INDEX "Product_canonicalName_idx" ON "Product"("canonicalName");

-- CreateIndex
CREATE INDEX "Product_setName_idx" ON "Product"("setName");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "Product"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIdentifier_type_value_key" ON "ProductIdentifier"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIdentifier_type_lower_value_key" ON "ProductIdentifier"("type", lower("value"));

-- CreateIndex
CREATE INDEX "ProductIdentifier_productId_idx" ON "ProductIdentifier"("productId");

-- CreateIndex
CREATE INDEX "Report_storeId_createdAt_idx" ON "Report"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_productId_idx" ON "Report"("productId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "ReportUpdate_reportId_createdAt_idx" ON "ReportUpdate"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnmatchedReport_reportId_key" ON "UnmatchedReport"("reportId");

-- CreateIndex
CREATE INDEX "UnmatchedReport_adminStatus_idx" ON "UnmatchedReport"("adminStatus");

-- CreateIndex
CREATE INDEX "UnmatchedReport_createdAt_idx" ON "UnmatchedReport"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductIdentifier" ADD CONSTRAINT "ProductIdentifier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportUpdate" ADD CONSTRAINT "ReportUpdate_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmatchedReport" ADD CONSTRAINT "UnmatchedReport_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmatchedReport" ADD CONSTRAINT "UnmatchedReport_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

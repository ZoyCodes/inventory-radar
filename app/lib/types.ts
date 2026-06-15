export type RetailerType =
  | "target"
  | "walmart"
  | "cvs"
  | "walgreens"
  | "gamestop"
  | "local_card_shop"
  | "other";

export type ProductType =
  | "etb"
  | "booster_bundle"
  | "booster_box"
  | "collection_box"
  | "tin"
  | "mini_tin"
  | "blister"
  | "other";

export type ProductIdentifierType =
  | "upc"
  | "retailer_sku"
  | "alias"
  | "normalized_name"
  | "retailer_url";

export type ReportStatus = "in_stock" | "low_stock" | "sold_out" | "unknown";
export type ReportSource = "user" | "scraper" | "admin";
export type ReportUpdateStatus = "still_there" | "gone" | "restocked" | "incorrect";
export type AdminStatus = "pending" | "matched" | "ignored";

export type Store = {
  id: string;
  name: string;
  retailerType: RetailerType;
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  canonicalName: string;
  setName?: string | null;
  productType: ProductType;
  imageUrl?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductIdentifier = {
  id: string;
  productId: string;
  type: ProductIdentifierType;
  value: string;
  source?: string | null;
  createdAt: string;
};

export type Report = {
  id: string;
  storeId: string;
  productId?: string | null;
  rawProductText?: string | null;
  rawPrice?: string | null;
  quantityObserved?: number | null;
  status: ReportStatus;
  photoUrl?: string | null;
  source: ReportSource;
  matchConfidence?: number | null;
  matchMethod?: string | null;
  createdBy?: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export type ReportUpdate = {
  id: string;
  reportId: string;
  status: ReportUpdateStatus;
  createdBy?: string | null;
  createdAt: string;
};

export type UnmatchedReport = {
  id: string;
  reportId: string;
  rawProductText: string;
  photoUrl?: string | null;
  adminStatus: AdminStatus;
  matchedProductId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InventoryDb = {
  stores: Store[];
  products: Product[];
  productIdentifiers: ProductIdentifier[];
  reports: Report[];
  reportUpdates: ReportUpdate[];
  unmatchedReports: UnmatchedReport[];
};

export type EnrichedReport = Report & {
  store: Store;
  product?: Product | null;
  updates: ReportUpdate[];
};

export type MatchResult = {
  productId: string | null;
  confidence: number | null;
  method: string | null;
};

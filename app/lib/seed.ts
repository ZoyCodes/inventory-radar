import type { InventoryDb, Product, ProductIdentifier, Store } from "./types";

const now = new Date().toISOString();

const productSeedTuples: Array<[
  string,
  string | undefined,
  Product["productType"],
  string[]
]> = [
  ["Scarlet & Violet 151 Elite Trainer Box", "Scarlet & Violet 151", "etb", ["151 etb", "pokemon 151 etb"]],
  ["Scarlet & Violet 151 Booster Bundle", "Scarlet & Violet 151", "booster_bundle", ["151 booster bundle", "pokemon 151 bundle"]],
  ["Scarlet & Violet 151 Ultra-Premium Collection", "Scarlet & Violet 151", "collection_box", ["151 upc", "151 ultra premium"]],
  ["Paldean Fates Elite Trainer Box", "Paldean Fates", "etb", ["paldean fates etb", "pf etb"]],
  ["Paldean Fates Booster Bundle", "Paldean Fates", "booster_bundle", ["paldean fates bundle", "pf bundle"]],
  ["Paldean Fates Tech Sticker Collection", "Paldean Fates", "collection_box", ["paldean fates sticker", "pf tech sticker"]],
  ["Obsidian Flames Elite Trainer Box", "Obsidian Flames", "etb", ["obsidian flames etb", "of etb"]],
  ["Obsidian Flames Booster Bundle", "Obsidian Flames", "booster_bundle", ["obsidian flames bundle", "of bundle"]],
  ["Temporal Forces Elite Trainer Box", "Temporal Forces", "etb", ["temporal forces etb", "tf etb"]],
  ["Temporal Forces Booster Bundle", "Temporal Forces", "booster_bundle", ["temporal forces bundle", "tf bundle"]],
  ["Twilight Masquerade Elite Trainer Box", "Twilight Masquerade", "etb", ["twilight masquerade etb", "tm etb"]],
  ["Twilight Masquerade Booster Bundle", "Twilight Masquerade", "booster_bundle", ["twilight masquerade bundle", "tm bundle"]],
  ["Shrouded Fable Elite Trainer Box", "Shrouded Fable", "etb", ["shrouded fable etb", "sf etb"]],
  ["Shrouded Fable Booster Bundle", "Shrouded Fable", "booster_bundle", ["shrouded fable bundle", "sf bundle"]],
  ["Surging Sparks Elite Trainer Box", "Surging Sparks", "etb", ["surging sparks etb", "ss etb"]],
  ["Surging Sparks Booster Bundle", "Surging Sparks", "booster_bundle", ["surging sparks bundle", "ss bundle"]],
  ["Prismatic Evolutions Elite Trainer Box", "Prismatic Evolutions", "etb", ["prismatic evolutions etb", "pe etb"]],
  ["Prismatic Evolutions Booster Bundle", "Prismatic Evolutions", "booster_bundle", ["prismatic evolutions bundle", "pe bundle"]],
  ["Journey Together Elite Trainer Box", "Journey Together", "etb", ["journey together etb", "jt etb"]],
  ["Journey Together Booster Bundle", "Journey Together", "booster_bundle", ["journey together bundle", "jt bundle"]],
  ["Destined Rivals Elite Trainer Box", "Destined Rivals", "etb", ["destined rivals etb", "dr etb"]],
  ["Destined Rivals Booster Bundle", "Destined Rivals", "booster_bundle", ["destined rivals bundle", "dr bundle"]],
  ["Crown Zenith Elite Trainer Box", "Crown Zenith", "etb", ["crown zenith etb", "cz etb"]],
  ["Crown Zenith Sea & Sky Premium Collection", "Crown Zenith", "collection_box", ["sea and sky", "cz sea sky"]],
  ["Silver Tempest Elite Trainer Box", "Silver Tempest", "etb", ["silver tempest etb", "st etb"]],
  ["Lost Origin Elite Trainer Box", "Lost Origin", "etb", ["lost origin etb", "lo etb"]],
  ["Astral Radiance Elite Trainer Box", "Astral Radiance", "etb", ["astral radiance etb", "ar etb"]],
  ["Brilliant Stars Elite Trainer Box", "Brilliant Stars", "etb", ["brilliant stars etb", "bs etb"]],
  ["Evolving Skies Elite Trainer Box", "Evolving Skies", "etb", ["evolving skies etb", "es etb"]],
  ["Fusion Strike Elite Trainer Box", "Fusion Strike", "etb", ["fusion strike etb", "fs etb"]],
  ["Pokemon GO Elite Trainer Box", "Pokemon GO", "etb", ["pogo etb", "pokemon go etb"]],
  ["Charizard ex Super-Premium Collection", undefined, "collection_box", ["charizard ex spc", "charizard super premium"]],
  ["Greninja ex Ultra-Premium Collection", undefined, "collection_box", ["greninja upc", "greninja ex upc"]],
  ["Miraidon ex League Battle Deck", undefined, "other", ["miraidon battle deck", "miraidon deck"]],
  ["Koraidon ex Premium Collection", undefined, "collection_box", ["koraidon collection", "koraidon ex box"]],
  ["Combined Powers Premium Collection", undefined, "collection_box", ["combined powers", "combined powers box"]],
  ["Stacking Tin: Fire", undefined, "tin", ["fire stacking tin", "stacking tin fire"]],
  ["Stacking Tin: Water", undefined, "tin", ["water stacking tin", "stacking tin water"]],
  ["Stacking Tin: Grass", undefined, "tin", ["grass stacking tin", "stacking tin grass"]],
  ["Paldea Adventure Chest", undefined, "collection_box", ["adventure chest", "paldea chest"]],
  ["Back to School Pencil Tin", undefined, "tin", ["pencil tin", "back to school tin"]],
  ["Back to School Eraser Blister", undefined, "blister", ["eraser blister", "back to school blister"]],
  ["Three-Pack Blister Assortment", undefined, "blister", ["3 pack blister", "three pack blister"]],
  ["Checklane Blister Assortment", undefined, "blister", ["checklane blister", "single blister"]],
  ["Mini Tin Assortment", undefined, "mini_tin", ["mini tin", "pokemon mini tin"]],
  ["Booster Pack Assortment", undefined, "other", ["single booster", "loose packs"]],
  ["Booster Box Assortment", undefined, "booster_box", ["booster box", "pokemon booster box"]],
  ["Holiday Calendar", undefined, "collection_box", ["pokemon calendar", "holiday calendar"]],
  ["Collector Chest", undefined, "collection_box", ["collector chest", "lunchbox"]],
  ["Poster Collection", undefined, "collection_box", ["poster collection", "poster box"]],
  ["Binder Collection", undefined, "collection_box", ["binder collection", "binder box"]]
];

const productSeeds: Array<{
  canonicalName: string;
  setName?: string;
  productType: Product["productType"];
  aliases: string[];
}> = productSeedTuples.map(([canonicalName, setName, productType, aliases]) => ({
  canonicalName,
  setName,
  productType,
  aliases
}));

export const seedStores: Store[] = [
  ["store-target-colonie", "Target - Colonie", "target", "1440 Central Ave, Colonie, NY 12205", 42.7084, -73.8169],
  ["store-target-latham", "Target - Latham", "target", "675 Troy Schenectady Rd, Latham, NY 12110", 42.7585, -73.7624],
  ["store-target-clifton-park", "Target - Clifton Park", "target", "26 Crossing Blvd, Clifton Park, NY 12065", 42.8587, -73.7853],
  ["store-walmart-glenmont", "Walmart Supercenter - Glenmont", "walmart", "311 Route 9W, Glenmont, NY 12077", 42.6004, -73.7897],
  ["store-walmart-east-greenbush", "Walmart Supercenter - East Greenbush", "walmart", "279 Troy Rd, Rensselaer, NY 12144", 42.6281, -73.6987],
  ["store-walmart-clifton-park", "Walmart Supercenter - Clifton Park", "walmart", "1549 US-9, Clifton Park, NY 12065", 42.8557, -73.7589],
  ["store-walmart-crossgates", "Walmart Supercenter - Crossgates Commons", "walmart", "141 Washington Ave Extension, Albany, NY 12205", 42.6909, -73.8539],
  ["store-gamestop-colonie", "GameStop - Colonie Center", "gamestop", "131 Colonie Center, Albany, NY 12205", 42.7112, -73.8157],
  ["store-gamestop-crossgates", "GameStop - Crossgates Mall", "gamestop", "1 Crossgates Mall Rd, Albany, NY 12203", 42.6884, -73.8511],
  ["store-cvs-delmar", "CVS - Delmar", "cvs", "260 Delaware Ave, Delmar, NY 12054", 42.6224, -73.8324],
  ["store-walgreens-holland", "Walgreens - Holland Ave", "walgreens", "41 Holland Ave, Albany, NY 12208", 42.6509, -73.7769],
  ["store-zombie-planet", "Zombie Planet", "local_card_shop", "1238 Central Ave, Albany, NY 12205", 42.6976, -73.8084]
].map(([id, name, retailerType, address, latitude, longitude]) => ({
  id: id as string,
  name: name as string,
  retailerType: retailerType as Store["retailerType"],
  address: address as string,
  latitude: latitude as number,
  longitude: longitude as number,
  placeId: null,
  createdAt: now,
  updatedAt: now
}));

export const seedProducts: Product[] = productSeeds.map((product, index) => ({
  id: `product-${String(index + 1).padStart(3, "0")}`,
  canonicalName: product.canonicalName,
  setName: product.setName ?? null,
  productType: product.productType,
  imageUrl: null,
  active: true,
  createdAt: now,
  updatedAt: now
}));

export const seedProductIdentifiers: ProductIdentifier[] = productSeeds.flatMap(
  (product, index) => {
    const productId = `product-${String(index + 1).padStart(3, "0")}`;
    const normalizedName = normalizeSeedName(product.canonicalName);
    const aliases = Array.from(new Set([normalizedName, ...product.aliases.map(normalizeSeedName)]));

    return aliases.map((value, aliasIndex) => ({
      id: `identifier-${String(index + 1).padStart(3, "0")}-${String(aliasIndex + 1).padStart(2, "0")}`,
      productId,
      type: aliasIndex === 0 ? "normalized_name" : "alias",
      value,
      source: "manual_seed",
      createdAt: now
    }));
  }
);

export const seedDb: InventoryDb = {
  stores: seedStores,
  products: seedProducts,
  productIdentifiers: seedProductIdentifiers,
  reports: [
    {
      id: "report-001",
      storeId: "store-target-colonie",
      productId: "product-002",
      rawProductText: "151 booster bundles",
      rawPrice: "26.99",
      quantityObserved: 6,
      status: "in_stock",
      photoUrl: null,
      source: "user",
      matchConfidence: 1,
      matchMethod: "seed",
      createdBy: "anonymous-seed",
      createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      expiresAt: null
    },
    {
      id: "report-002",
      storeId: "store-gamestop-crossgates",
      productId: "product-017",
      rawProductText: "Prismatic Evolutions ETB",
      rawPrice: "59.99",
      quantityObserved: 2,
      status: "low_stock",
      photoUrl: null,
      source: "user",
      matchConfidence: 1,
      matchMethod: "seed",
      createdBy: "anonymous-seed",
      createdAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      expiresAt: null
    },
    {
      id: "report-003",
      storeId: "store-walmart-glenmont",
      productId: null,
      rawProductText: "new dragon box by electronics",
      rawPrice: null,
      quantityObserved: 4,
      status: "unknown",
      photoUrl: null,
      source: "user",
      matchConfidence: null,
      matchMethod: "unmatched",
      createdBy: "anonymous-seed",
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      expiresAt: null
    }
  ],
  reportUpdates: [
    {
      id: "update-001",
      reportId: "report-001",
      status: "still_there",
      createdBy: "anonymous-seed",
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString()
    }
  ],
  unmatchedReports: [
    {
      id: "unmatched-001",
      reportId: "report-003",
      rawProductText: "new dragon box by electronics",
      photoUrl: null,
      adminStatus: "pending",
      matchedProductId: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
    }
  ]
};

function normalizeSeedName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\betb\b/g, "elite trainer box")
    .replace(/\bupc\b/g, "ultra premium collection")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

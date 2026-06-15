import type { InventoryDb, MatchResult } from "./types";

type MatchInput = {
  rawProductText?: string | null;
  upc?: string | null;
  retailerSku?: string | null;
};

export function matchProduct(db: InventoryDb, input: MatchInput): MatchResult {
  if (input.upc) {
    const match = db.productIdentifiers.find(
      (identifier) => identifier.type === "upc" && identifier.value === input.upc
    );
    if (match) return { productId: match.productId, confidence: 1, method: "exact_upc" };
  }

  if (input.retailerSku) {
    const match = db.productIdentifiers.find(
      (identifier) =>
        identifier.type === "retailer_sku" &&
        identifier.value.toLowerCase() === input.retailerSku?.toLowerCase()
    );
    if (match) return { productId: match.productId, confidence: 1, method: "exact_retailer_sku" };
  }

  const normalizedText = normalizeName(input.rawProductText ?? "");
  if (!normalizedText) return { productId: null, confidence: null, method: "unmatched" };

  const exactIdentifier = db.productIdentifiers.find(
    (identifier) =>
      (identifier.type === "alias" || identifier.type === "normalized_name") &&
      normalizeName(identifier.value) === normalizedText
  );
  if (exactIdentifier) {
    return { productId: exactIdentifier.productId, confidence: 1, method: "exact_name" };
  }

  const candidates = db.products
    .filter((product) => product.active)
    .flatMap((product) => {
      const aliases = db.productIdentifiers
        .filter((identifier) => identifier.productId === product.id)
        .map((identifier) => identifier.value);

      return [product.canonicalName, ...aliases].map((name) => ({
        productId: product.id,
        score: similarity(normalizedText, normalizeName(name))
      }));
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (best && best.score >= 0.62) {
    return {
      productId: best.productId,
      confidence: Number(best.score.toFixed(2)),
      method: "fuzzy_name"
    };
  }

  return { productId: null, confidence: null, method: "unmatched" };
}

export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\betb\b/g, "elite trainer box")
    .replace(/\bupc\b/g, "ultra premium collection")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.9;

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const intersection = [...aTokens].filter((token) =>
    [...bTokens].some((candidate) => tokensEquivalent(token, candidate))
  ).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  const tokenScore = union === 0 ? 0 : intersection / union;
  const distanceScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

  return tokenScore * 0.7 + distanceScore * 0.3;
}

function tokensEquivalent(a: string, b: string) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  return a.startsWith(b) || b.startsWith(a);
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, row) =>
    Array.from({ length: b.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0))
  );

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

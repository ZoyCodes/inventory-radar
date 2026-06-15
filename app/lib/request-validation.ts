import type { ReportStatus, ReportUpdateStatus } from "./types";

const reportStatuses: ReportStatus[] = ["in_stock", "low_stock", "sold_out", "unknown"];
const updateStatuses: ReportUpdateStatus[] = ["still_there", "gone", "restocked", "incorrect"];

export class RequestValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function readJsonObject(request: Request, maxBytes: number) {
  const length = request.headers.get("content-length");
  if (length && Number(length) > maxBytes) {
    throw new RequestValidationError("Request body is too large.", 413);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) {
    throw new RequestValidationError("Request body is too large.", 413);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new RequestValidationError("JSON body must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    throw new RequestValidationError("Invalid JSON body.");
  }
}

export function rejectUnknownFields(body: Record<string, unknown>, allowedFields: string[]) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RequestValidationError(`Unknown field: ${unknown[0]}`);
  }
}

export function requireString(
  body: Record<string, unknown>,
  key: string,
  options: { maxLength: number; pattern?: RegExp }
) {
  const value = body[key];
  if (typeof value !== "string") throw new RequestValidationError(`${key} is required.`);

  const cleaned = cleanText(value, options.maxLength);
  if (!cleaned) throw new RequestValidationError(`${key} is required.`);
  if (options.pattern && !options.pattern.test(cleaned)) {
    throw new RequestValidationError(`${key} is invalid.`);
  }
  return cleaned;
}

export function optionalString(
  body: Record<string, unknown>,
  key: string,
  options: { maxLength: number; pattern?: RegExp; allowUrl?: boolean }
) {
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new RequestValidationError(`${key} must be a string.`);

  const cleaned = cleanText(value, options.maxLength);
  if (!cleaned) return null;
  if (options.pattern && !options.pattern.test(cleaned)) {
    throw new RequestValidationError(`${key} is invalid.`);
  }
  if (options.allowUrl && !isSafeUrl(cleaned)) {
    throw new RequestValidationError(`${key} must be an http or https URL.`);
  }
  return cleaned;
}

export function optionalQuantity(body: Record<string, unknown>) {
  const value = body.quantityObserved;
  if (value == null || value === "") return null;

  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 10000) {
    throw new RequestValidationError("quantityObserved must be a non-negative integer.");
  }
  return number;
}

export function optionalPrice(body: Record<string, unknown>) {
  const raw = optionalString(body, "rawPrice", { maxLength: 32 });
  if (!raw) return null;

  const normalized = raw.replace(/^\$/, "");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 10000) {
    throw new RequestValidationError("rawPrice must be a sensible non-negative price.");
  }
  return normalized;
}

export function parseReportStatus(body: Record<string, unknown>) {
  const value = body.status ?? "unknown";
  if (typeof value !== "string" || !reportStatuses.includes(value as ReportStatus)) {
    throw new RequestValidationError("Invalid report status.");
  }
  return value as ReportStatus;
}

export function parseReportUpdateStatus(body: Record<string, unknown>) {
  const value = body.status;
  if (typeof value !== "string" || !updateStatuses.includes(value as ReportUpdateStatus)) {
    throw new RequestValidationError("Invalid update status.");
  }
  return value as ReportUpdateStatus;
}

export function cleanAlias(value: string | null) {
  if (!value) return null;
  const cleaned = cleanText(value, 80);
  const normalized = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const generic = new Set(["pokemon", "cards", "box", "etb", "tin", "packs", "pack", "booster"]);

  if (normalized.length < 5 || generic.has(normalized)) {
    throw new RequestValidationError("Alias is too generic.");
  }
  return cleaned;
}

export function cleanText(value: string, maxLength: number) {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > maxLength) {
    throw new RequestValidationError(`Value must be ${maxLength} characters or fewer.`);
  }
  return cleaned;
}

function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

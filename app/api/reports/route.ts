import { NextResponse } from "next/server";
import { createReport } from "@/app/lib/data";
import { checkRateLimit, getClientKey } from "@/app/lib/rate-limit";
import {
  optionalPrice,
  optionalQuantity,
  optionalString,
  parseReportStatus,
  readJsonObject,
  rejectUnknownFields,
  RequestValidationError,
  requireString
} from "@/app/lib/request-validation";

const allowedFields = [
  "storeId",
  "rawProductText",
  "rawPrice",
  "quantityObserved",
  "status",
  "photoUrl",
  "upc",
  "retailerSku",
  "createdBy"
];

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request, 4096);
    rejectUnknownFields(body, allowedFields);

    const createdBy = optionalString(body, "createdBy", {
      maxLength: 90,
      pattern: /^anon_[a-zA-Z0-9_-]{8,80}$/
    });
    const rateLimit = checkRateLimit({
      key: `report:${getClientKey(request, createdBy)}`,
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
    }

    const report = await createReport({
      storeId: requireString(body, "storeId", { maxLength: 80, pattern: /^[a-zA-Z0-9_-]+$/ }),
      rawProductText: requireString(body, "rawProductText", { maxLength: 160 }),
      rawPrice: optionalPrice(body),
      quantityObserved: optionalQuantity(body),
      status: parseReportStatus(body),
      photoUrl: optionalString(body, "photoUrl", { maxLength: 500, allowUrl: true }),
      upc: optionalString(body, "upc", { maxLength: 32, pattern: /^[0-9]{8,14}$/ }),
      retailerSku: optionalString(body, "retailerSku", { maxLength: 80 }),
      createdBy
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to create report." },
      { status: 500 }
    );
  }
}

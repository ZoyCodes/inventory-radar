import { NextResponse } from "next/server";
import { createReportUpdate } from "@/app/lib/data";
import { checkRateLimit, getClientKey } from "@/app/lib/rate-limit";
import {
  optionalString,
  parseReportUpdateStatus,
  readJsonObject,
  rejectUnknownFields,
  RequestValidationError,
  requireString
} from "@/app/lib/request-validation";

const allowedFields = ["reportId", "status", "createdBy"];

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request, 2048);
    rejectUnknownFields(body, allowedFields);

    const createdBy = optionalString(body, "createdBy", {
      maxLength: 90,
      pattern: /^anon_[a-zA-Z0-9_-]{8,80}$/
    });
    const rateLimit = checkRateLimit({
      key: `update:${getClientKey(request, createdBy)}`,
      limit: 30,
      windowMs: 10 * 60 * 1000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many report updates. Try again later." }, { status: 429 });
    }

    const result = await createReportUpdate({
      reportId: requireString(body, "reportId", { maxLength: 80, pattern: /^[a-zA-Z0-9_-]+$/ }),
      status: parseReportUpdateStatus(body),
      createdBy
    });
    const responseBody = result.changed && result.update ? { ...result.update, ...result } : result;
    return NextResponse.json(responseBody, { status: result.changed ? 201 : 200 });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to update report." },
      { status: 500 }
    );
  }
}

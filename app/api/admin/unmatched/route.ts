import { NextResponse } from "next/server";
import { getAdminSnapshot, resolveUnmatchedReport } from "@/app/lib/data";
import {
  optionalString,
  readJsonObject,
  rejectUnknownFields,
  RequestValidationError,
  requireString
} from "@/app/lib/request-validation";
import { requireAdmin, requireSameOriginForCookieAdmin } from "@/app/lib/security";
import type { AdminStatus } from "@/app/lib/types";

const allowedFields = ["unmatchedReportId", "adminStatus", "productId", "alias", "saveAlias"];

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const snapshot = await getAdminSnapshot();
  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const forbidden = requireSameOriginForCookieAdmin(request);
  if (forbidden) return forbidden;

  try {
    const body = await readJsonObject(request, 4096);
    rejectUnknownFields(body, allowedFields);

    const adminStatusValue = requireString(body, "adminStatus", { maxLength: 16 });
    if (!["matched", "ignored"].includes(adminStatusValue)) {
      return NextResponse.json({ error: "Invalid admin status." }, { status: 400 });
    }
    const adminStatus = adminStatusValue as AdminStatus;
    const productId =
      adminStatus === "matched"
        ? requireString(body, "productId", { maxLength: 80, pattern: /^[a-zA-Z0-9_-]+$/ })
        : null;

    const unmatched = await resolveUnmatchedReport({
      unmatchedReportId: requireString(body, "unmatchedReportId", {
        maxLength: 80,
        pattern: /^[a-zA-Z0-9_-]+$/
      }),
      adminStatus,
      productId,
      alias: optionalString(body, "alias", { maxLength: 80 }),
      saveAlias: Boolean(body.saveAlias)
    });

    return NextResponse.json(unmatched);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to update unmatched report." },
      { status: 500 }
    );
  }
}

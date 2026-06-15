import { NextResponse } from "next/server";
import { checkRateLimit, getClientKey } from "@/app/lib/rate-limit";
import { readJsonObject, rejectUnknownFields, RequestValidationError, requireString } from "@/app/lib/request-validation";
import { clearAdminCookie, isAdminRequest, isValidAdminToken, makeAdminCookie } from "@/app/lib/security";

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: isAdminRequest(request) });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request, 1024);
    rejectUnknownFields(body, ["token"]);
    const token = requireString(body, "token", { maxLength: 256 });
    const rateLimit = checkRateLimit({
      key: `admin-login:${getClientKey(request)}`,
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
    }

    if (!isValidAdminToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { authenticated: true },
      { headers: { "Set-Cookie": makeAdminCookie(token) } }
    );
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to authenticate." }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { authenticated: false },
    { headers: { "Set-Cookie": clearAdminCookie() } }
  );
}

import { NextResponse } from "next/server";

export const adminCookieName = "inventory_radar_admin";

export type AuthRequest = Request & {
  cookies?: {
    get(name: string): { value: string } | undefined;
  };
};

export function isAdminRequest(request: AuthRequest) {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken || expectedToken.length < 32) return false;

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
  const cookieToken = request.cookies?.get(adminCookieName)?.value ?? readCookie(request, adminCookieName);
  const suppliedToken = bearerToken || cookieToken;

  return suppliedToken ? timingSafeEqual(suppliedToken, expectedToken) : false;
}

export function isValidAdminToken(token: string) {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken || expectedToken.length < 32) return false;
  return timingSafeEqual(token, expectedToken);
}

export function requireAdmin(request: AuthRequest) {
  if (isAdminRequest(request)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function requireSameOriginForCookieAdmin(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return null;

  const origin = request.headers.get("origin");
  if (!origin) return null;

  if (origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export function makeAdminCookie(token: string) {
  return `${adminCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function clearAdminCookie() {
  return `${adminCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function assertProductionGuardrails() {
  if (process.env.NODE_ENV !== "production") return;

  if (!process.env.ADMIN_TOKEN || process.env.ADMIN_TOKEN.length < 32) {
    throw new Error("ADMIN_TOKEN must be set to at least 32 characters in production.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in production.");
  }
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  return (
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let index = 0; index < aBytes.length; index += 1) {
    diff |= aBytes[index] ^ bBytes[index];
  }
  return diff === 0;
}

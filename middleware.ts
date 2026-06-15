import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "./app/lib/security";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return NextResponse.next();
    if (!isAdminRequest(request)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  if (pathname.startsWith("/api/admin/") && pathname !== "/api/admin/session") {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};

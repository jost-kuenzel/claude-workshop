import { NextResponse, type NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const payload = token ? await verifyToken(token) : null;
  const path = request.nextUrl.pathname;

  // Protect dashboard routes
  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/customers") ||
    path.startsWith("/users")
  ) {
    if (!payload) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Redirect authenticated users away from login
  if (path === "/login" && payload) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};

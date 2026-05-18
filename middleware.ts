import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "youtube_clipper_session";

function sessionToken() {
  const secret = process.env.AUTH_SESSION_SECRET || "local-youtube-clipper-session-secret";
  const username = process.env.ADMIN_USERNAME || "admin";
  return `${username}:${secret}`;
}

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/api/auth") || pathname.startsWith("/_next") || pathname === "/favicon.ico";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token === sessionToken()) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

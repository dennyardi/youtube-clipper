import { NextResponse } from "next/server";
import { AUTH_COOKIE, getAdminPassword, getAdminUsername } from "@/lib/auth";

export const runtime = "nodejs";

function sessionToken() {
  const secret = process.env.AUTH_SESSION_SECRET || "local-youtube-clipper-session-secret";
  const username = process.env.ADMIN_USERNAME || "admin";
  return `${username}:${secret}`;
}

export async function POST(request: Request) {
  const payload = await request.json();
  const username = String(payload.username || "");
  const password = String(payload.password || "");

  if (username !== getAdminUsername() || password !== getAdminPassword()) {
    return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

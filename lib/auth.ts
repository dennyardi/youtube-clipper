import crypto from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "youtube_clipper_session";

function sessionSecret() {
  return process.env.AUTH_SESSION_SECRET || "local-youtube-clipper-session-secret";
}

export function getAdminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "denny1998";
}

export function createSessionToken() {
  return crypto.createHmac("sha256", sessionSecret()).update(`${getAdminUsername()}:youtube-clipper-maker`).digest("hex");
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value === createSessionToken();
}

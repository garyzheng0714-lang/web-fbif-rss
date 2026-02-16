import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { revokeSession, SESSION_COOKIE_NAME } from "@/modules/auth/session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await revokeSession(token);
  }

  const response = NextResponse.redirect(new URL("/login", env.APP_BASE_URL));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

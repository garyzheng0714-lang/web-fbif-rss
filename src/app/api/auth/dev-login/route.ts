import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { createSessionForUser, SESSION_COOKIE_NAME } from "@/modules/auth/session";

function shouldUseSecureCookie(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const requestIsHttps = forwardedProto
    ? forwardedProto.split(",")[0]?.trim() === "https"
    : request.nextUrl.protocol === "https:";
  return requestIsHttps || env.APP_BASE_URL.startsWith("https://");
}

export async function GET(request: NextRequest) {
  if (!env.DEV_AUTH_BYPASS_ENABLED) {
    return NextResponse.json(
      {
        ok: false,
        message: "Dev auth bypass is disabled",
      },
      { status: 404 },
    );
  }

  const user = await db.user.upsert({
    where: { openId: "dev-local-openid" },
    update: {
      name: "Local Dev User",
      tenantKey: "local-dev",
    },
    create: {
      openId: "dev-local-openid",
      name: "Local Dev User",
      tenantKey: "local-dev",
    },
  });

  const session = await createSessionForUser(user.id);
  const response = NextResponse.redirect(new URL("/dashboard", env.APP_BASE_URL));
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    expires: session.expiresAt,
  });

  return response;
}


import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { signInWithFeishuCode } from "@/modules/auth/auth-service";
import { SESSION_COOKIE_NAME } from "@/modules/auth/session";
import { OAUTH_STATE_COOKIE } from "@/app/api/auth/feishu/start/route";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, env.APP_BASE_URL));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=missing_code_or_state", env.APP_BASE_URL));
  }

  const stateFromCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!stateFromCookie || stateFromCookie !== state) {
    return NextResponse.redirect(new URL("/login?error=invalid_state", env.APP_BASE_URL));
  }

  try {
    const { session } = await signInWithFeishuCode(code);
    const response = NextResponse.redirect(new URL("/dashboard", env.APP_BASE_URL));

    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });

    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, env.APP_BASE_URL),
    );
  }
}

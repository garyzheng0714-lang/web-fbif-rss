import { NextRequest, NextResponse } from "next/server";
import { buildFeishuAuthorizeUrl, isFeishuAuthConfigured } from "@/modules/auth/feishu";
import { randomStateToken } from "@/lib/utils";
import { env } from "@/lib/env";

const OAUTH_STATE_COOKIE = "fbif_feishu_state";

function shouldUseSecureCookie(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const requestIsHttps = forwardedProto
    ? forwardedProto.split(",")[0]?.trim() === "https"
    : request.nextUrl.protocol === "https:";
  return requestIsHttps || env.APP_BASE_URL.startsWith("https://");
}

export async function GET(request: NextRequest) {
  if (!isFeishuAuthConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Feishu OAuth is not configured",
      },
      { status: 500 },
    );
  }

  const state = randomStateToken();
  const loginUrl = buildFeishuAuthorizeUrl(state);
  const response = NextResponse.redirect(loginUrl);

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
  });

  return response;
}

export { OAUTH_STATE_COOKIE };

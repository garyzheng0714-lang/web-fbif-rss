import { NextResponse } from "next/server";
import { buildFeishuAuthorizeUrl, isFeishuAuthConfigured } from "@/modules/auth/feishu";
import { randomStateToken } from "@/lib/utils";
import { env } from "@/lib/env";

const OAUTH_STATE_COOKIE = "fbif_feishu_state";

export async function GET() {
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
    secure: env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}

export { OAUTH_STATE_COOKIE };

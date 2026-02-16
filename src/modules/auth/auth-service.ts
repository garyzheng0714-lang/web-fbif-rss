import { env } from "@/lib/env";
import { db } from "@/lib/db";
import {
  exchangeCodeForUserAccessToken,
  fetchFeishuUserIdentity,
  isFeishuAuthConfigured,
} from "@/modules/auth/feishu";
import { createSessionForUser } from "@/modules/auth/session";

export async function signInWithFeishuCode(code: string) {
  const userAccessToken = await exchangeCodeForUserAccessToken(code);
  const identity = await fetchFeishuUserIdentity(userAccessToken);

  if (env.FEISHU_ALLOWED_TENANT_KEY && identity.tenantKey !== env.FEISHU_ALLOWED_TENANT_KEY) {
    throw new Error(`Tenant not allowed: ${identity.tenantKey ?? "unknown"}`);
  }

  const user = await db.user.upsert({
    where: { openId: identity.openId },
    update: {
      userId: identity.userId,
      tenantKey: identity.tenantKey,
      name: identity.name,
      email: identity.email,
      avatarUrl: identity.avatarUrl,
    },
    create: {
      openId: identity.openId,
      userId: identity.userId,
      tenantKey: identity.tenantKey,
      name: identity.name,
      email: identity.email,
      avatarUrl: identity.avatarUrl,
    },
  });

  const session = await createSessionForUser(user.id);
  return {
    user,
    session,
  };
}

export function getFeishuDebugInfo() {
  return {
    configured: isFeishuAuthConfigured(),
    appId: env.FEISHU_APP_ID,
    redirectUri: env.FEISHU_OAUTH_REDIRECT_URI,
    baseUrl: env.APP_BASE_URL,
    scope: env.FEISHU_OAUTH_SCOPE,
    allowTenantKey: env.FEISHU_ALLOWED_TENANT_KEY ?? null,
    alertMode: env.FEISHU_ALERT_MODE,
  };
}

import { env } from "@/lib/env";
import { fetchJson, HttpError } from "@/lib/http";

const FEISHU_BASE_URL = "https://open.feishu.cn";
const FEISHU_ACCOUNT_BASE = "https://accounts.feishu.cn";

interface OAuthTokenResponse {
  code: number;
  error?: string;
  error_description?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface FeishuUserInfoResponse {
  code: number;
  msg?: string;
  data?: {
    open_id?: string;
    user_id?: string;
    union_id?: string;
    name?: string;
    avatar_url?: string;
    email?: string;
    tenant_key?: string;
  };
  open_id?: string;
  user_id?: string;
  union_id?: string;
  name?: string;
  avatar_url?: string;
  email?: string;
  tenant_key?: string;
}

interface TenantTokenResponse {
  code: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
}

let cachedTenantToken: { token: string; expiresAtMs: number } | null = null;

export interface FeishuIdentity {
  openId: string;
  userId?: string;
  tenantKey?: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export function isFeishuAuthConfigured(): boolean {
  return Boolean(env.FEISHU_APP_ID && env.FEISHU_APP_SECRET);
}

export function buildFeishuAuthorizeUrl(state: string): string {
  const url = new URL(`${FEISHU_ACCOUNT_BASE}/open-apis/authen/v1/authorize`);
  url.searchParams.set("app_id", env.FEISHU_APP_ID);
  url.searchParams.set("redirect_uri", env.FEISHU_OAUTH_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  if (env.FEISHU_OAUTH_SCOPE.trim().length > 0) {
    url.searchParams.set("scope", env.FEISHU_OAUTH_SCOPE.trim());
  }
  return url.toString();
}

export async function exchangeCodeForUserAccessToken(code: string): Promise<string> {
  const body = {
    grant_type: "authorization_code",
    client_id: env.FEISHU_APP_ID,
    client_secret: env.FEISHU_APP_SECRET,
    code,
    redirect_uri: env.FEISHU_OAUTH_REDIRECT_URI,
  };

  const response = await fetchJson<OAuthTokenResponse>(`${FEISHU_BASE_URL}/open-apis/authen/v2/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    timeoutMs: 10000,
  });

  if (response.code !== 0 || !response.access_token) {
    throw new HttpError(
      `Failed to exchange OAuth code: ${response.error_description ?? response.error ?? "unknown error"}`,
      400,
      response,
    );
  }

  return response.access_token;
}

export async function fetchFeishuUserIdentity(userAccessToken: string): Promise<FeishuIdentity> {
  const response = await fetchJson<FeishuUserInfoResponse>(`${FEISHU_BASE_URL}/open-apis/authen/v1/user_info`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    timeoutMs: 10000,
  });

  if (response.code !== 0) {
    throw new HttpError(`Failed to fetch Feishu user info: ${response.msg ?? "unknown"}`, 400, response);
  }

  const raw = response.data ?? response;
  const openId = raw.open_id;

  if (!openId) {
    throw new HttpError("Feishu user info missing open_id", 400, response);
  }

  return {
    openId,
    userId: raw.user_id,
    tenantKey: raw.tenant_key,
    name: raw.name ?? "Feishu User",
    email: raw.email,
    avatarUrl: raw.avatar_url,
  };
}

export async function getTenantAccessToken(forceRefresh = false): Promise<string> {
  if (!isFeishuAuthConfigured()) {
    throw new Error("FEISHU_APP_ID/FEISHU_APP_SECRET not configured");
  }

  const now = Date.now();
  if (!forceRefresh && cachedTenantToken && cachedTenantToken.expiresAtMs > now + 30_000) {
    return cachedTenantToken.token;
  }

  const response = await fetchJson<TenantTokenResponse>(
    `${FEISHU_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: env.FEISHU_APP_ID,
        app_secret: env.FEISHU_APP_SECRET,
      }),
      timeoutMs: 10000,
    },
  );

  if (response.code !== 0 || !response.tenant_access_token || !response.expire) {
    throw new HttpError("Failed to fetch tenant_access_token", 400, response);
  }

  cachedTenantToken = {
    token: response.tenant_access_token,
    expiresAtMs: now + response.expire * 1000,
  };

  return cachedTenantToken.token;
}

export async function checkFeishuConnectivity() {
  const token = await getTenantAccessToken(true);
  return {
    ok: true,
    tokenPrefix: token.slice(0, 8),
  };
}

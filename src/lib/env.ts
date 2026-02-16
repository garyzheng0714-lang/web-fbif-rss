import { z } from "zod";
import { parseBooleanFlag } from "@/lib/utils";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/postgres?schema=public"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(24).default("local-dev-change-me-please-123456"),

  FEISHU_APP_ID: z.string().default(""),
  FEISHU_APP_SECRET: z.string().default(""),
  FEISHU_OAUTH_REDIRECT_URI: z.string().optional(),
  FEISHU_OAUTH_SCOPE: z.string().default("auth:user.id:read offline_access"),
  FEISHU_ALLOWED_TENANT_KEY: z.string().optional(),

  FEISHU_ALERT_MODE: z.enum(["none", "webhook", "app"]).default("none"),
  FEISHU_ALERT_WEBHOOK_URL: z.string().optional(),
  FEISHU_ALERT_RECEIVE_ID: z.string().optional(),
  FEISHU_ALERT_RECEIVE_ID_TYPE: z
    .enum(["open_id", "user_id", "chat_id", "email", "union_id"])
    .default("open_id"),

  BITABLE_BASE_URL: z.string().optional(),
  BITABLE_APP_TOKEN: z.string().optional(),
  BITABLE_ITEM_TABLE_ID: z.string().optional(),
  BITABLE_SOURCE_TABLE_ID: z.string().optional(),
  BITABLE_ITEM_FIELD_TITLE: z.string().default("标题"),
  BITABLE_ITEM_FIELD_SUMMARY: z.string().default("摘要"),
  BITABLE_ITEM_FIELD_LINK: z.string().default("链接"),
  BITABLE_ITEM_FIELD_SOURCE: z.string().default("来源"),
  BITABLE_ITEM_FIELD_PUBLISHED_AT: z.string().default("发布时间"),
  BITABLE_ITEM_FIELD_HASH: z.string().default("去重哈希"),

  BITABLE_SOURCE_FIELD_NAME: z.string().default("名称"),
  BITABLE_SOURCE_FIELD_URL: z.string().default("URL"),
  BITABLE_SOURCE_FIELD_CATEGORY: z.string().default("分类"),
  BITABLE_SOURCE_FIELD_ENABLED: z.string().default("启用"),
  BITABLE_SOURCE_FIELD_TYPE: z.string().default("类型"),
  BITABLE_SOURCE_FIELD_INTERVAL: z.string().default("轮询分钟"),

  SOURCE_SYNC_ENABLED: z.string().optional(),
  RSS_SCHEDULER_CRON: z.string().default("*/5 * * * *"),
  SOURCE_SYNC_CRON: z.string().default("*/20 * * * *"),
  RSS_FETCH_TIMEOUT_MS: z.coerce.number().int().min(3000).default(12000),
  RSS_FETCH_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(8),
  RSS_MAX_ITEMS_PER_FETCH: z.coerce.number().int().min(1).max(200).default(40),
  RSS_FAIL_THRESHOLD: z.coerce.number().int().min(1).max(20).default(3),
});

function extractAppTokenFromBitableUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  const matched = url.match(/\/base\/([^/?]+)/);
  return matched?.[1];
}

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issue = parsed.error.issues
    .map((item) => `${item.path.join(".")}: ${item.message}`)
    .join("; ");
  throw new Error(`Invalid environment variables: ${issue}`);
}

const values = parsed.data;

export const env = {
  ...values,
  FEISHU_OAUTH_REDIRECT_URI:
    values.FEISHU_OAUTH_REDIRECT_URI ?? `${values.APP_BASE_URL}/api/auth/feishu/callback`,
  BITABLE_APP_TOKEN: values.BITABLE_APP_TOKEN ?? extractAppTokenFromBitableUrl(values.BITABLE_BASE_URL),
  SOURCE_SYNC_ENABLED: parseBooleanFlag(values.SOURCE_SYNC_ENABLED, false),
};

export type AppEnv = typeof env;

import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import { getTenantAccessToken } from "@/modules/auth/feishu";

interface FeishuSendMessageResponse {
  code: number;
  msg?: string;
}

export async function sendFeishuAlertText(text: string, uuid: string) {
  if (env.FEISHU_ALERT_MODE === "none") {
    return { skipped: true };
  }

  if (env.FEISHU_ALERT_MODE === "webhook") {
    if (!env.FEISHU_ALERT_WEBHOOK_URL) {
      throw new Error("FEISHU_ALERT_WEBHOOK_URL is required when FEISHU_ALERT_MODE=webhook");
    }

    await fetchJson<unknown>(env.FEISHU_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: {
          text,
        },
      }),
      timeoutMs: 10000,
    });

    return { skipped: false };
  }

  if (!env.FEISHU_ALERT_RECEIVE_ID) {
    throw new Error("FEISHU_ALERT_RECEIVE_ID is required when FEISHU_ALERT_MODE=app");
  }

  const token = await getTenantAccessToken();
  const response = await fetchJson<FeishuSendMessageResponse>(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${env.FEISHU_ALERT_RECEIVE_ID_TYPE}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        receive_id: env.FEISHU_ALERT_RECEIVE_ID,
        msg_type: "text",
        content: JSON.stringify({ text }),
        uuid: uuid.slice(0, 50),
      }),
      timeoutMs: 10000,
    },
  );

  if (response.code !== 0) {
    throw new Error(`Failed to send Feishu alert: ${response.msg ?? "unknown"}`);
  }

  return { skipped: false };
}

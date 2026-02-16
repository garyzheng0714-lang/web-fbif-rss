import { FeedSource, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { deterministicUuid } from "@/lib/utils";
import { sendFeishuAlertText } from "@/modules/notifications/feishu-notifier";

export async function notifySourceUnavailable(
  source: Pick<FeedSource, "id" | "name" | "url">,
  failureCount: number,
  errorMessage: string,
) {
  const eventKey = `source-down:${source.id}:${failureCount}`;
  const message = [
    "[RSS 监控告警] 信源连续失败",
    `信源: ${source.name}`,
    `地址: ${source.url}`,
    `连续失败次数: ${failureCount}`,
    `错误: ${errorMessage}`,
    `时间: ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
  ].join("\n");

  await emitAlert(eventKey, "ERROR", message, {
    sourceId: source.id,
    failureCount,
  });
}

export async function notifySourceRecovered(source: Pick<FeedSource, "id" | "name" | "url">) {
  const now = Date.now();
  const minuteBucket = Math.floor(now / 60000);
  const eventKey = `source-recovered:${source.id}:${minuteBucket}`;
  const message = [
    "[RSS 监控恢复] 信源恢复正常",
    `信源: ${source.name}`,
    `地址: ${source.url}`,
    `时间: ${new Date(now).toLocaleString("zh-CN", { hour12: false })}`,
  ].join("\n");

  await emitAlert(eventKey, "INFO", message, {
    sourceId: source.id,
  });
}

async function emitAlert(eventKey: string, level: string, message: string, payload: Record<string, unknown>) {
  try {
    await db.notificationEvent.create({
      data: {
        eventKey,
        level,
        message,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return;
    }
    throw error;
  }

  await sendFeishuAlertText(message, deterministicUuid(eventKey));
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  return code === "P2002";
}

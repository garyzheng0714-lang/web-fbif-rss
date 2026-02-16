import { jsonError, jsonOk } from "@/lib/api";
import { checkFeishuConnectivity } from "@/modules/auth/feishu";
import { resolveBitableTablesPreview } from "@/modules/bitable/sync-service";

export async function GET() {
  try {
    const [connectivity, tables] = await Promise.all([
      checkFeishuConnectivity(),
      resolveBitableTablesPreview(),
    ]);

    return jsonOk({
      ...connectivity,
      bitableTables: tables,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "feishu_check_failed", 500);
  }
}

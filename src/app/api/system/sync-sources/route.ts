import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { runSourceSyncPipeline } from "@/modules/worker/pipeline";

export async function POST() {
  try {
    await requireApiUser();
    const result = await runSourceSyncPipeline();
    return jsonOk(result);
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to sync sources", 500);
  }
}

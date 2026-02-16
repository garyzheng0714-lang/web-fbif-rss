import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { runPollingPipeline } from "@/modules/worker/pipeline";

export async function POST() {
  try {
    await requireApiUser();
    const result = await runPollingPipeline();
    return jsonOk(result);
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to run polling pipeline", 500);
  }
}

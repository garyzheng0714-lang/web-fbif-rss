import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { deduplicateRsshubSources } from "@/modules/feeds/source-service";

export async function POST() {
  try {
    await requireApiUser();
    const result = await deduplicateRsshubSources();
    return jsonOk(result);
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to deduplicate sources", 500);
  }
}

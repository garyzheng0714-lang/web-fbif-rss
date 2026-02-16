import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { probeRsshubMirrors } from "@/modules/feeds/rsshub-mirror";

export async function GET() {
  try {
    await requireApiUser();
    const mirrors = await probeRsshubMirrors();
    return jsonOk(mirrors);
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to probe RSSHub mirrors", 500);
  }
}

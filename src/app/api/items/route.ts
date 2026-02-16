import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { listFeedItems } from "@/modules/feeds/item-service";

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "30", 10);
    const sourceId = url.searchParams.get("sourceId") ?? undefined;
    const q = url.searchParams.get("q") ?? undefined;

    const result = await listFeedItems({
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 30 : pageSize,
      sourceId,
      query: q,
    });

    return jsonOk(result);
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to fetch items", 500);
  }
}

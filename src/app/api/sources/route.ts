import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { createSource, listSources, parseTags } from "@/modules/feeds/source-service";

export async function GET() {
  try {
    await requireApiUser();
    const sources = await listSources();
    return jsonOk(sources);
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to fetch sources", 500);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = (await request.json()) as {
      name?: string;
      url?: string;
      type?: "RSS" | "WECHAT_PLACEHOLDER";
      category?: string;
      tags?: string[] | string;
      enabled?: boolean;
      pollIntervalMinutes?: number;
    };

    const source = await createSource({
      ...body,
      tags: Array.isArray(body.tags) ? body.tags : parseTags(body.tags),
    });
    return jsonOk(source, { status: 201 });
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to create source", 400);
  }
}

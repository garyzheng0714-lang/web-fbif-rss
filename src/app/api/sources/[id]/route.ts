import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { deleteSource, parseTags, updateSource } from "@/modules/feeds/source-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json()) as {
      name?: string;
      url?: string;
      type?: "RSS" | "WECHAT_PLACEHOLDER";
      category?: string;
      tags?: string[] | string;
      enabled?: boolean;
      pollIntervalMinutes?: number;
    };

    const source = await updateSource(id, {
      ...body,
      tags: Array.isArray(body.tags) ? body.tags : parseTags(body.tags),
    });

    return jsonOk(source);
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to update source", 400);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    await deleteSource(id);
    return jsonOk({ id });
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to delete source", 400);
  }
}

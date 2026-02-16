import { z } from "zod";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { isBitableSourceSyncConfigured, syncSourcesBidirectional } from "@/modules/bitable/sync-service";
import {
  normalizeMirrorOriginInput,
  probeRsshubMirrors,
  RsshubMirrorProbeResult,
} from "@/modules/feeds/rsshub-mirror";
import { switchRsshubSourcesToMirror } from "@/modules/feeds/source-service";

const requestSchema = z.object({
  mode: z.enum(["auto", "manual"]).default("auto"),
  targetOrigin: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = requestSchema.parse(await request.json());

    const mirrors = await probeRsshubMirrors();
    const onlineMirrors = mirrors
      .filter((mirror) => mirror.online)
      .sort((a, b) => (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER));

    if (onlineMirrors.length === 0) {
      return jsonError("没有可用的 RSSHub 服务器，请稍后重试", 400);
    }

    let target: RsshubMirrorProbeResult;
    try {
      target = selectTargetMirror(body.mode, body.targetOrigin, mirrors, onlineMirrors);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "目标服务器参数错误", 400);
    }
    if (!target.online) {
      return jsonError("目标服务器当前不可用，请选择在线服务器", 400);
    }

    const summary = await switchRsshubSourcesToMirror(target.origin);

    let sourceSyncResult: { skipped: boolean; pulled: number; pushed: number; reason: string } | null = null;
    if (isBitableSourceSyncConfigured() && summary.updated > 0) {
      sourceSyncResult = await syncSourcesBidirectional();
    }

    return jsonOk({
      mode: body.mode,
      selected: target,
      summary,
      sourceSyncResult,
      mirrors,
    });
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof z.ZodError) {
      return jsonError("请求参数不合法", 400, error.flatten());
    }
    return jsonError(error instanceof Error ? error.message : "Failed to switch RSSHub mirror", 500);
  }
}

function selectTargetMirror(
  mode: "auto" | "manual",
  targetOrigin: string | undefined,
  mirrors: RsshubMirrorProbeResult[],
  onlineMirrors: RsshubMirrorProbeResult[],
): RsshubMirrorProbeResult {
  if (mode === "auto") {
    return onlineMirrors[0] as RsshubMirrorProbeResult;
  }

  if (!targetOrigin) {
    throw new Error("Manual mode requires targetOrigin");
  }

  const normalized = normalizeMirrorOriginInput(targetOrigin);
  if (!normalized) {
    throw new Error("Invalid targetOrigin");
  }

  const matched = mirrors.find((mirror) => mirror.origin === normalized);
  if (!matched) {
    throw new Error("目标服务器不在镜像列表中");
  }

  return matched;
}

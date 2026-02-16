import { z } from "zod";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import {
  getDefaultPriorityIntervals,
  getPriorityIntervals,
  updatePriorityIntervals,
} from "@/modules/feeds/priority-settings";
import { runPollingPipeline } from "@/modules/worker/pipeline";

const requestSchema = z.object({
  high: z.number().int().min(5).max(1440).optional(),
  medium: z.number().int().min(5).max(1440).optional(),
  low: z.number().int().min(5).max(1440).optional(),
});

export async function GET() {
  try {
    await requireApiUser();
    const intervals = await getPriorityIntervals();
    return jsonOk({
      intervals: toApiIntervalShape(intervals),
      defaults: toApiIntervalShape(getDefaultPriorityIntervals()),
    });
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to load priority settings", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireApiUser();
    const body = requestSchema.parse(await request.json());
    const updated = await updatePriorityIntervals({
      ...(body.high !== undefined ? { HIGH: body.high } : {}),
      ...(body.medium !== undefined ? { MEDIUM: body.medium } : {}),
      ...(body.low !== undefined ? { LOW: body.low } : {}),
    });

    void runPollingPipeline();

    return jsonOk({
      intervals: toApiIntervalShape(updated.intervals),
      updatedSources: updated.updatedSources,
      pollingTriggered: true,
    });
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof z.ZodError) {
      return jsonError("请求参数不合法", 400, error.flatten());
    }
    return jsonError(error instanceof Error ? error.message : "Failed to update priority settings", 400);
  }
}

function toApiIntervalShape(intervals: { HIGH: number; MEDIUM: number; LOW: number }) {
  return {
    high: intervals.HIGH,
    medium: intervals.MEDIUM,
    low: intervals.LOW,
  };
}

import { SourcePriority } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

const PRIORITY_INTERVAL_SETTING_KEY = "source_priority_intervals_v1";

const priorityIntervalSchema = z.object({
  HIGH: z.number().int().min(5).max(1440),
  MEDIUM: z.number().int().min(5).max(1440),
  LOW: z.number().int().min(5).max(1440),
});

export type PriorityIntervals = z.infer<typeof priorityIntervalSchema>;

const defaultPriorityIntervals: PriorityIntervals = {
  HIGH: 10,
  MEDIUM: 20,
  LOW: 30,
};

export async function getPriorityIntervals(): Promise<PriorityIntervals> {
  const setting = await db.systemSetting.findUnique({
    where: { key: PRIORITY_INTERVAL_SETTING_KEY },
    select: { value: true },
  });

  if (!setting) {
    return defaultPriorityIntervals;
  }

  const parsed = priorityIntervalSchema.safeParse(setting.value);
  if (!parsed.success) {
    return defaultPriorityIntervals;
  }

  return parsed.data;
}

export function getDefaultPriorityIntervals(): PriorityIntervals {
  return defaultPriorityIntervals;
}

export function resolvePollIntervalByPriority(priority: SourcePriority, intervals: PriorityIntervals): number {
  return intervals[priority];
}

export async function updatePriorityIntervals(
  partialInput: Partial<PriorityIntervals>,
): Promise<{
  intervals: PriorityIntervals;
  updatedSources: number;
}> {
  const current = await getPriorityIntervals();
  const merged = priorityIntervalSchema.parse({ ...current, ...partialInput });

  const result = await db.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key: PRIORITY_INTERVAL_SETTING_KEY },
      create: {
        key: PRIORITY_INTERVAL_SETTING_KEY,
        value: merged,
      },
      update: {
        value: merged,
      },
    });

    const priorities: SourcePriority[] = [SourcePriority.HIGH, SourcePriority.MEDIUM, SourcePriority.LOW];
    let updatedSources = 0;

    for (const priority of priorities) {
      const updateResult = await tx.feedSource.updateMany({
        where: { priority },
        data: { pollIntervalMinutes: merged[priority] },
      });
      updatedSources += updateResult.count;
    }

    await tx.feedSource.updateMany({
      where: { enabled: true },
      data: { lastCheckedAt: null },
    });

    return {
      intervals: merged,
      updatedSources,
    };
  });

  return result;
}

import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { isBitableItemSyncConfigured, isBitableSourceSyncConfigured } from "@/modules/bitable/sync-service";

export async function GET() {
  try {
    await requireApiUser();

    const [sourceTotal, sourceEnabled, itemTotal, unsyncedItems, failingSources, recentAlerts] = await Promise.all([
      db.feedSource.count(),
      db.feedSource.count({ where: { enabled: true } }),
      db.feedItem.count(),
      db.feedItem.count({ where: { syncedToBitableAt: null } }),
      db.feedSource.findMany({
        where: { failureCount: { gt: 0 } },
        orderBy: [{ failureCount: "desc" }, { lastErrorAt: "desc" }],
        take: 10,
      }),
      db.notificationEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return jsonOk({
      sourceTotal,
      sourceEnabled,
      itemTotal,
      unsyncedItems,
      failingSources,
      recentAlerts,
      bitableItemSyncConfigured: isBitableItemSyncConfigured(),
      bitableSourceSyncConfigured: isBitableSourceSyncConfigured(),
    });
  } catch (error) {
    if (error instanceof Response) {
      return jsonError("Unauthorized", 401);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to fetch system status", 500);
  }
}

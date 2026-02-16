import { runFeedPollingCycle } from "@/modules/feeds/feed-fetcher";
import { syncSourcesBidirectional, syncUnsyncedItemsToBitable } from "@/modules/bitable/sync-service";

let polling = false;
let sourceSyncing = false;

export async function runPollingPipeline() {
  if (polling) {
    return { skipped: true, reason: "polling already running" };
  }

  polling = true;
  try {
    const pollResult = await runFeedPollingCycle();
    const bitableResult = await syncUnsyncedItemsToBitable(200);
    return {
      skipped: false,
      pollResult,
      bitableResult,
    };
  } finally {
    polling = false;
  }
}

export async function runSourceSyncPipeline() {
  if (sourceSyncing) {
    return { skipped: true, reason: "source sync already running" };
  }

  sourceSyncing = true;
  try {
    const result = await syncSourcesBidirectional();
    return {
      skipped: false,
      result,
    };
  } finally {
    sourceSyncing = false;
  }
}

import "dotenv/config";
import cron from "node-cron";
import { env } from "@/lib/env";
import {
  runPollingPipeline,
  runRsshubMirrorMaintenancePipeline,
  runSourceSyncPipeline,
} from "@/modules/worker/pipeline";

async function boot() {
  console.log("[worker] started", {
    rssCron: env.RSS_SCHEDULER_CRON,
    sourceSyncCron: env.SOURCE_SYNC_CRON,
    mirrorCheckCron: env.RSSHUB_MIRROR_CHECK_CRON,
    mirrorAutoSwitchEnabled: env.RSSHUB_MIRROR_AUTO_SWITCH_ENABLED,
  });

  await runPollingOnce("startup");

  cron.schedule(env.RSS_SCHEDULER_CRON, () => {
    void runPollingOnce("schedule");
  });

  cron.schedule(env.SOURCE_SYNC_CRON, () => {
    void runSourceSyncOnce("schedule");
  });

  cron.schedule(env.RSSHUB_MIRROR_CHECK_CRON, () => {
    void runMirrorMaintenanceOnce("schedule");
  });
}

async function runPollingOnce(trigger: string) {
  try {
    const result = await runPollingPipeline();
    console.log(`[worker] polling trigger=${trigger}`, result);
  } catch (error) {
    console.error("[worker] polling error", error);
  }
}

async function runSourceSyncOnce(trigger: string) {
  try {
    const result = await runSourceSyncPipeline();
    console.log(`[worker] source-sync trigger=${trigger}`, result);
  } catch (error) {
    console.error("[worker] source-sync error", error);
  }
}

async function runMirrorMaintenanceOnce(trigger: string) {
  try {
    const result = await runRsshubMirrorMaintenancePipeline();
    console.log(`[worker] mirror-maintenance trigger=${trigger}`, result);
  } catch (error) {
    console.error("[worker] mirror-maintenance error", error);
  }
}

void boot();

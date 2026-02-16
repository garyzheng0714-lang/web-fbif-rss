import { env } from "@/lib/env";
import { runFeedPollingCycle } from "@/modules/feeds/feed-fetcher";
import { probeRsshubMirrors, RsshubMirrorProbeResult } from "@/modules/feeds/rsshub-mirror";
import { getRsshubSourceOverview, switchRsshubSourcesToMirror } from "@/modules/feeds/source-service";
import { syncSourcesBidirectional, syncUnsyncedItemsToBitable } from "@/modules/bitable/sync-service";

let polling = false;
let sourceSyncing = false;
let mirrorMaintaining = false;

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

export interface MirrorMaintenanceDecision {
  action: "keep" | "switch" | "none";
  reason: string;
  selectedMirror: RsshubMirrorProbeResult | null;
}

export function decideMirrorMaintenanceTarget(input: {
  currentHost: string | null;
  onlineMirrors: RsshubMirrorProbeResult[];
}): MirrorMaintenanceDecision {
  const { currentHost, onlineMirrors } = input;
  if (onlineMirrors.length === 0) {
    return {
      action: "none",
      reason: "no online rsshub mirrors",
      selectedMirror: null,
    };
  }

  if (currentHost) {
    const currentMirror = onlineMirrors.find((mirror) => mirror.host.toLowerCase() === currentHost.toLowerCase());
    if (currentMirror) {
      return {
        action: "keep",
        reason: `current mirror ${currentHost} is online`,
        selectedMirror: currentMirror,
      };
    }
    return {
      action: "switch",
      reason: `current mirror ${currentHost} is offline`,
      selectedMirror: onlineMirrors[0] as RsshubMirrorProbeResult,
    };
  }

  return {
    action: "switch",
    reason: "no current mirror host found",
    selectedMirror: onlineMirrors[0] as RsshubMirrorProbeResult,
  };
}

export async function runRsshubMirrorMaintenancePipeline() {
  if (mirrorMaintaining) {
    return { skipped: true, reason: "mirror maintenance already running" };
  }

  if (!env.RSSHUB_MIRROR_AUTO_SWITCH_ENABLED) {
    return { skipped: true, reason: "rsshub mirror auto switch disabled" };
  }

  mirrorMaintaining = true;
  try {
    const overview = await getRsshubSourceOverview();
    if (overview.rsshubSourceCount === 0) {
      return {
        skipped: true,
        reason: "no rsshub sources",
        rsshubSourceCount: 0,
      };
    }

    const mirrors = await probeRsshubMirrors();
    const onlineMirrors = mirrors
      .filter((mirror) => mirror.online)
      .sort((a, b) => (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER));

    const decision = decideMirrorMaintenanceTarget({
      currentHost: overview.dominantHost,
      onlineMirrors,
    });

    if (decision.action === "none" || !decision.selectedMirror) {
      return {
        skipped: false,
        switched: false,
        reason: decision.reason,
        rsshubSourceCount: overview.rsshubSourceCount,
        currentHost: overview.dominantHost,
        hostUsage: overview.hostUsage,
        mirrors,
      };
    }

    if (decision.action === "keep") {
      return {
        skipped: false,
        switched: false,
        reason: decision.reason,
        rsshubSourceCount: overview.rsshubSourceCount,
        currentHost: overview.dominantHost,
        selectedMirror: decision.selectedMirror,
        hostUsage: overview.hostUsage,
        mirrors,
      };
    }

    const switchSummary = await switchRsshubSourcesToMirror(decision.selectedMirror.origin);
    let sourceSyncResult: { skipped: boolean; pulled: number; pushed: number; reason: string } | null = null;

    if (switchSummary.updated > 0) {
      sourceSyncResult = await syncSourcesBidirectional();
    }

    return {
      skipped: false,
      switched: switchSummary.updated > 0,
      reason: decision.reason,
      rsshubSourceCount: overview.rsshubSourceCount,
      currentHost: overview.dominantHost,
      selectedMirror: decision.selectedMirror,
      hostUsage: overview.hostUsage,
      switchSummary,
      sourceSyncResult,
      mirrors,
    };
  } finally {
    mirrorMaintaining = false;
  }
}

import { describe, expect, test } from "vitest";
import { RsshubMirrorProbeResult } from "@/modules/feeds/rsshub-mirror";
import { decideMirrorMaintenanceTarget } from "@/modules/worker/pipeline";

function mirror(host: string, latencyMs: number): RsshubMirrorProbeResult {
  return {
    origin: `https://${host}`,
    host,
    online: true,
    latencyMs,
    statusCode: 200,
    checkedAt: "2026-02-16T12:00:00.000Z",
  };
}

describe("decideMirrorMaintenanceTarget", () => {
  test("returns none when no online mirror", () => {
    const decision = decideMirrorMaintenanceTarget({
      currentHost: "rsshub.umzzz.com",
      onlineMirrors: [],
    });

    expect(decision.action).toBe("none");
    expect(decision.selectedMirror).toBeNull();
  });

  test("keeps current mirror when current host is online", () => {
    const decision = decideMirrorMaintenanceTarget({
      currentHost: "rsshub.umzzz.com",
      onlineMirrors: [mirror("rsshub.umzzz.com", 200), mirror("hub.slarker.me", 150)],
    });

    expect(decision.action).toBe("keep");
    expect(decision.selectedMirror?.host).toBe("rsshub.umzzz.com");
  });

  test("switches to fastest online mirror when current host is offline", () => {
    const decision = decideMirrorMaintenanceTarget({
      currentHost: "rsshub.rssforever.com",
      onlineMirrors: [mirror("hub.slarker.me", 140), mirror("rsshub.umzzz.com", 180)],
    });

    expect(decision.action).toBe("switch");
    expect(decision.selectedMirror?.host).toBe("hub.slarker.me");
  });
});

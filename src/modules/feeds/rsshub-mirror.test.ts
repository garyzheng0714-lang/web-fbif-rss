import { describe, expect, test } from "vitest";
import {
  buildRsshubCandidateUrls,
  extractRsshubRouteKey,
  isRsshubSourceUrl,
  isSameRsshubRoute,
  normalizeRsshubSourceUrl,
  parseRsshubMirrorOrigins,
  rewriteRsshubSourceToMirror,
} from "@/modules/feeds/rsshub-mirror";

describe("rsshub-mirror", () => {
  test("parseRsshubMirrorOrigins keeps valid origins and de-duplicates", () => {
    const parsed = parseRsshubMirrorOrigins(
      "hub.slarker.me, https://hub.slarker.me, https://rsshub.umzzz.com,http://#bad",
    );

    expect(parsed).toEqual(["https://hub.slarker.me", "https://rsshub.umzzz.com"]);
  });

  test("normalizeRsshubSourceUrl rewrites rsshub.app to first mirror", () => {
    const normalized = normalizeRsshubSourceUrl(
      "https://rsshub.app/36kr/newsflashes?limit=20",
      ["https://rsshub.umzzz.com", "https://hub.slarker.me"],
    );

    expect(normalized).toBe("https://rsshub.umzzz.com/36kr/newsflashes?limit=20");
  });

  test("buildRsshubCandidateUrls excludes offline official host", () => {
    const candidates = buildRsshubCandidateUrls("https://rsshub.app/36kr/newsflashes", [
      "https://rsshub.umzzz.com",
      "https://hub.slarker.me",
    ]);

    expect(candidates).toEqual([
      "https://rsshub.umzzz.com/36kr/newsflashes",
      "https://hub.slarker.me/36kr/newsflashes",
    ]);
  });

  test("buildRsshubCandidateUrls keeps non-rsshub urls unchanged", () => {
    const candidates = buildRsshubCandidateUrls("https://sspai.com/feed", ["https://rsshub.umzzz.com"]);
    expect(candidates).toEqual(["https://sspai.com/feed"]);
  });

  test("isRsshubSourceUrl identifies rsshub mirrors", () => {
    const isRsshub = isRsshubSourceUrl("https://hub.slarker.me/36kr/newsflashes", ["https://hub.slarker.me"]);
    expect(isRsshub).toBe(true);
  });

  test("rewriteRsshubSourceToMirror keeps route while switching origin", () => {
    const rewritten = rewriteRsshubSourceToMirror(
      "https://hub.slarker.me/36kr/newsflashes?limit=20",
      "https://rsshub.umzzz.com",
      ["https://hub.slarker.me", "https://rsshub.umzzz.com"],
    );
    expect(rewritten).toBe("https://rsshub.umzzz.com/36kr/newsflashes?limit=20");
  });

  test("extractRsshubRouteKey normalizes trailing slash and query order", () => {
    const routeKey = extractRsshubRouteKey(
      "https://rsshub.umzzz.com/36kr/newsflashes/?b=2&a=1",
      ["https://rsshub.umzzz.com"],
    );
    expect(routeKey).toBe("/36kr/newsflashes?a=1&b=2");
  });

  test("isSameRsshubRoute returns true for different mirrors", () => {
    const same = isSameRsshubRoute(
      "https://rsshub.umzzz.com/36kr/newsflashes?limit=20",
      "https://rsshub.rssforever.com/36kr/newsflashes?limit=20",
      ["https://rsshub.umzzz.com", "https://rsshub.rssforever.com"],
    );
    expect(same).toBe(true);
  });
});

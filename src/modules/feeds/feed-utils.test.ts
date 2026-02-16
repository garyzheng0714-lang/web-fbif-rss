import { describe, expect, test } from "vitest";
import type { FeedSource } from "@prisma/client";
import { buildFeedGuid, buildFeedHash, isSourceDue } from "@/modules/feeds/feed-utils";

describe("feed-utils", () => {
  test("buildFeedGuid uses guid when available", () => {
    const guid = buildFeedGuid("source-1", {
      guid: "raw-guid",
      title: "hello",
      link: "https://example.com",
    });

    expect(guid).toBe("raw-guid");
  });

  test("buildFeedHash keeps deterministic output", () => {
    const hash1 = buildFeedHash({
      title: "A",
      link: "https://example.com/a",
      isoDate: "2025-01-01",
    });
    const hash2 = buildFeedHash({
      title: "A",
      link: "https://example.com/a",
      isoDate: "2025-01-01",
    });

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  test("isSourceDue returns true when interval elapsed", () => {
    const source = {
      enabled: true,
      pollIntervalMinutes: 10,
      lastCheckedAt: new Date("2026-02-16T00:00:00.000Z"),
    } as FeedSource;

    const due = isSourceDue(source, new Date("2026-02-16T00:11:00.000Z"));
    expect(due).toBe(true);
  });

  test("isSourceDue returns true when due time is within grace window", () => {
    const source = {
      enabled: true,
      pollIntervalMinutes: 10,
      lastCheckedAt: new Date("2026-02-16T00:00:00.500Z"),
    } as FeedSource;

    const due = isSourceDue(source, new Date("2026-02-16T00:10:00.000Z"));
    expect(due).toBe(true);
  });

  test("isSourceDue returns false when due time is far from now", () => {
    const source = {
      enabled: true,
      pollIntervalMinutes: 10,
      lastCheckedAt: new Date("2026-02-16T00:00:00.000Z"),
    } as FeedSource;

    const due = isSourceDue(source, new Date("2026-02-16T00:08:30.000Z"));
    expect(due).toBe(false);
  });

  test("isSourceDue returns false when source disabled", () => {
    const source = {
      enabled: false,
      pollIntervalMinutes: 10,
      lastCheckedAt: null,
    } as FeedSource;

    const due = isSourceDue(source, new Date());
    expect(due).toBe(false);
  });
});

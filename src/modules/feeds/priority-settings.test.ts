import { SourcePriority } from "@prisma/client";
import { describe, expect, test } from "vitest";
import { getDefaultPriorityIntervals, resolvePollIntervalByPriority } from "@/modules/feeds/priority-settings";

describe("priority-settings", () => {
  test("uses expected default priority intervals", () => {
    const defaults = getDefaultPriorityIntervals();
    expect(defaults).toEqual({
      HIGH: 10,
      MEDIUM: 20,
      LOW: 30,
    });
  });

  test("resolves poll interval by source priority", () => {
    const defaults = getDefaultPriorityIntervals();
    expect(resolvePollIntervalByPriority(SourcePriority.HIGH, defaults)).toBe(10);
    expect(resolvePollIntervalByPriority(SourcePriority.MEDIUM, defaults)).toBe(20);
    expect(resolvePollIntervalByPriority(SourcePriority.LOW, defaults)).toBe(30);
  });
});

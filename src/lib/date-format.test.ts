import { describe, expect, it } from "vitest";
import { formatDateTimeCn } from "@/lib/date-format";

describe("formatDateTimeCn", () => {
  it("formats UTC timestamp in Asia/Shanghai timezone by default", () => {
    const value = formatDateTimeCn("2026-02-17T04:09:23.000Z");
    expect(value).toBe("2026/02/17 12:09");
  });

  it("returns dash for invalid value", () => {
    expect(formatDateTimeCn("invalid-date")).toBe("-");
  });
});

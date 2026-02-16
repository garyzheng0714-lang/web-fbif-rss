import { describe, expect, test } from "vitest";
import { buildFeishuAuthorizeUrl } from "@/modules/auth/feishu";

describe("feishu oauth url", () => {
  test("contains required params", () => {
    const url = buildFeishuAuthorizeUrl("state-123");
    const parsed = new URL(url);

    expect(parsed.hostname).toBe("accounts.feishu.cn");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("state")).toBe("state-123");
  });
});

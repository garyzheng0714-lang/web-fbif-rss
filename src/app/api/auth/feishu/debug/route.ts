import { jsonOk } from "@/lib/api";
import { getFeishuDebugInfo } from "@/modules/auth/auth-service";

export async function GET() {
  return jsonOk(getFeishuDebugInfo());
}

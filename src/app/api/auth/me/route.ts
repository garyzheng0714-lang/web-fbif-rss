import { cookies } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api";
import { getUserFromCookies } from "@/modules/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserFromCookies(cookieStore);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  return jsonOk(user);
}

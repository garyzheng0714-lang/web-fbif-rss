import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserFromCookies } from "@/modules/auth/session";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, message, details }, { status });
}

export async function requireApiUser() {
  const cookieStore = await cookies();
  const user = await getUserFromCookies(cookieStore);
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return user;
}

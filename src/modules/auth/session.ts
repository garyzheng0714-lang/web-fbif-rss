import { addDays } from "@/modules/auth/time";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "fbif_session";
const SESSION_DAYS = 14;

interface CookieLike {
  get(name: string): { value: string } | undefined;
}

export async function createSessionForUser(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID();
  const expiresAt = addDays(new Date(), SESSION_DAYS);

  await db.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } });
}

export async function getUserBySessionToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const now = new Date();

  const session = await db.session.findFirst({
    where: {
      token,
      expiresAt: { gt: now },
    },
    include: {
      user: true,
    },
  });

  return session?.user ?? null;
}

export async function getUserFromCookies(cookieStore: CookieLike) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getUserBySessionToken(token);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return getUserFromCookies(cookieStore);
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

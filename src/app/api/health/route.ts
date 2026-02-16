import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const now = new Date().toISOString();

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "web-fbif-rss",
      timestamp: now,
      database: "up",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "web-fbif-rss",
        timestamp: now,
        database: "down",
        message: error instanceof Error ? error.message : "unknown",
      },
      { status: 503 },
    );
  }
}

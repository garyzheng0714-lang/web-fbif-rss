import { Prisma, SourceType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  isRsshubSourceUrl,
  normalizeMirrorOriginInput,
  normalizeRsshubSourceUrl,
  parseRsshubMirrorOrigins,
  rewriteRsshubSourceToMirror,
} from "@/modules/feeds/rsshub-mirror";

export const createSourceSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().max(2048),
  type: z.nativeEnum(SourceType).default(SourceType.RSS),
  category: z.string().max(64).optional(),
  tags: z.array(z.string().max(40)).default([]),
  enabled: z.boolean().default(true),
  pollIntervalMinutes: z.number().int().min(5).max(1440).default(10),
});

export const updateSourceSchema = createSourceSchema.partial();

export async function listSources() {
  return db.feedSource.findMany({
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createSource(input: unknown) {
  const payload = createSourceSchema.parse(input);
  return db.feedSource.create({
    data: {
      ...payload,
      tags: sanitizeTags(payload.tags),
      url: normalizeRsshubSourceUrl(payload.url.trim()),
      category: payload.category?.trim() || null,
    },
  });
}

export async function updateSource(id: string, input: unknown) {
  const payload = updateSourceSchema.parse(input);
  const data: Prisma.FeedSourceUpdateInput = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.url ? { url: normalizeRsshubSourceUrl(payload.url.trim()) } : {}),
    ...(payload.type ? { type: payload.type } : {}),
    ...(payload.category !== undefined ? { category: payload.category?.trim() || null } : {}),
    ...(payload.tags ? { tags: sanitizeTags(payload.tags) } : {}),
    ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
    ...(payload.pollIntervalMinutes !== undefined
      ? { pollIntervalMinutes: payload.pollIntervalMinutes }
      : {}),
  };

  return db.feedSource.update({
    where: { id },
    data,
  });
}

export async function deleteSource(id: string) {
  return db.feedSource.delete({ where: { id } });
}

export interface SwitchRsshubSourcesResult {
  targetOrigin: string;
  totalSources: number;
  rsshubSources: number;
  updated: number;
  unchanged: number;
  conflicts: number;
  failed: number;
}

export interface RsshubSourceOverview {
  rsshubSourceCount: number;
  dominantHost: string | null;
  hostUsage: Array<{ host: string; count: number }>;
}

export async function switchRsshubSourcesToMirror(targetOrigin: string): Promise<SwitchRsshubSourcesResult> {
  const normalizedTarget = normalizeMirrorOriginInput(targetOrigin);
  if (!normalizedTarget) {
    throw new Error("Invalid target mirror");
  }

  const mirrorOrigins = parseRsshubMirrorOrigins();
  const sources = await db.feedSource.findMany({
    where: { type: SourceType.RSS },
    select: {
      id: true,
      url: true,
    },
  });

  let rsshubSources = 0;
  let updated = 0;
  let unchanged = 0;
  let conflicts = 0;
  let failed = 0;

  for (const source of sources) {
    if (!isRsshubSourceUrl(source.url, mirrorOrigins)) {
      continue;
    }
    rsshubSources += 1;

    const nextUrl = rewriteRsshubSourceToMirror(source.url, normalizedTarget, mirrorOrigins);
    if (nextUrl === source.url) {
      unchanged += 1;
      continue;
    }

    try {
      await db.feedSource.update({
        where: { id: source.id },
        data: { url: nextUrl },
      });
      updated += 1;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        conflicts += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    targetOrigin: normalizedTarget,
    totalSources: sources.length,
    rsshubSources,
    updated,
    unchanged,
    conflicts,
    failed,
  };
}

export async function getRsshubSourceOverview(): Promise<RsshubSourceOverview> {
  const mirrorOrigins = parseRsshubMirrorOrigins();
  const sources = await db.feedSource.findMany({
    where: { type: SourceType.RSS },
    select: { url: true },
  });

  const usage = new Map<string, number>();

  for (const source of sources) {
    if (!isRsshubSourceUrl(source.url, mirrorOrigins)) {
      continue;
    }

    const host = safeHost(source.url);
    if (!host) {
      continue;
    }
    usage.set(host, (usage.get(host) ?? 0) + 1);
  }

  const hostUsage = [...usage.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host));

  return {
    rsshubSourceCount: hostUsage.reduce((sum, item) => sum + item.count, 0),
    dominantHost: hostUsage[0]?.host ?? null,
    hostUsage,
  };
}

export function parseTags(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return sanitizeTags(value.split(","));
}

function sanitizeTags(tags: string[]): string[] {
  const result = tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 30);
  return [...new Set(result)];
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function safeHost(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

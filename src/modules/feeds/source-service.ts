import { Prisma, SourcePriority, SourceType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  extractRsshubRouteKey,
  isRsshubSourceUrl,
  normalizeMirrorOriginInput,
  normalizeRsshubSourceUrl,
  parseRsshubMirrorOrigins,
  rewriteRsshubSourceToMirror,
} from "@/modules/feeds/rsshub-mirror";
import { getPriorityIntervals, resolvePollIntervalByPriority } from "@/modules/feeds/priority-settings";

export const createSourceSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().max(2048),
  type: z.nativeEnum(SourceType).default(SourceType.RSS),
  priority: z.nativeEnum(SourcePriority).default(SourcePriority.MEDIUM),
  category: z.string().max(64).optional(),
  tags: z.array(z.string().max(40)).default([]),
  enabled: z.boolean().default(true),
  pollIntervalMinutes: z.number().int().min(5).max(1440).optional(),
});

export const updateSourceSchema = createSourceSchema.partial();

export async function listSources() {
  return db.feedSource.findMany({
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createSource(input: unknown) {
  const payload = createSourceSchema.parse(input);
  const intervals = await getPriorityIntervals();
  const pollIntervalMinutes =
    payload.pollIntervalMinutes ?? resolvePollIntervalByPriority(payload.priority, intervals);
  const normalizedUrl = normalizeRsshubSourceUrl(payload.url.trim());
  await ensureNoRsshubRouteDuplicate(normalizedUrl, payload.type);

  return db.feedSource.create({
    data: {
      ...payload,
      pollIntervalMinutes,
      tags: sanitizeTags(payload.tags),
      url: normalizedUrl,
      category: payload.category?.trim() || null,
    },
  });
}

export async function updateSource(id: string, input: unknown) {
  const payload = updateSourceSchema.parse(input);
  const intervals = await getPriorityIntervals();
  const current = await db.feedSource.findUnique({
    where: { id },
    select: { type: true, url: true },
  });
  if (!current) {
    throw new Error("Source not found");
  }

  const nextType = payload.type ?? current.type;
  const nextUrl = payload.url ? normalizeRsshubSourceUrl(payload.url.trim()) : current.url;
  await ensureNoRsshubRouteDuplicate(nextUrl, nextType, id);

  const data: Prisma.FeedSourceUpdateInput = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.url ? { url: nextUrl } : {}),
    ...(payload.type ? { type: payload.type } : {}),
    ...(payload.priority ? { priority: payload.priority } : {}),
    ...(payload.category !== undefined ? { category: payload.category?.trim() || null } : {}),
    ...(payload.tags ? { tags: sanitizeTags(payload.tags) } : {}),
    ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
    ...(payload.pollIntervalMinutes !== undefined
      ? { pollIntervalMinutes: payload.pollIntervalMinutes }
      : payload.priority
        ? { pollIntervalMinutes: resolvePollIntervalByPriority(payload.priority, intervals) }
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
  deduplicatedSources: number;
  updated: number;
  unchanged: number;
  conflicts: number;
  failed: number;
}

export interface DeduplicateRsshubSourcesResult {
  inspected: number;
  duplicateGroups: number;
  deduplicatedSources: number;
  movedItems: number;
  skippedItems: number;
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

  const dedupe = await deduplicateRsshubSources();

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
    deduplicatedSources: dedupe.deduplicatedSources,
    updated,
    unchanged,
    conflicts,
    failed,
  };
}

export async function deduplicateRsshubSources(): Promise<DeduplicateRsshubSourcesResult> {
  const mirrorOrigins = parseRsshubMirrorOrigins();
  const sources = await db.feedSource.findMany({
    where: { type: SourceType.RSS },
    select: {
      id: true,
      name: true,
      url: true,
      enabled: true,
      bitableRecordId: true,
      lastSuccessAt: true,
      lastCheckedAt: true,
      createdAt: true,
    },
  });

  const groups = new Map<string, Array<(typeof sources)[number]>>();
  for (const source of sources) {
    const routeKey = extractRsshubRouteKey(source.url, mirrorOrigins);
    if (!routeKey) {
      continue;
    }

    const members = groups.get(routeKey) ?? [];
    members.push(source);
    groups.set(routeKey, members);
  }

  let duplicateGroups = 0;
  let deduplicatedSources = 0;
  let movedItems = 0;
  let skippedItems = 0;

  for (const members of groups.values()) {
    if (members.length <= 1) {
      continue;
    }
    duplicateGroups += 1;

    const sorted = [...members].sort(compareSourcePriorityForKeep);
    const keeper = sorted[0];
    if (!keeper) {
      continue;
    }

    for (const duplicate of sorted.slice(1)) {
      const merged = await mergeFeedSourceInto(duplicate.id, keeper.id, duplicate.bitableRecordId);
      deduplicatedSources += merged.removedSources;
      movedItems += merged.movedItems;
      skippedItems += merged.skippedItems;
    }
  }

  return {
    inspected: sources.length,
    duplicateGroups,
    deduplicatedSources,
    movedItems,
    skippedItems,
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

export async function findSourceByRsshubRouteKey(routeKey: string, excludeId?: string) {
  const mirrorOrigins = parseRsshubMirrorOrigins();
  const sources = await db.feedSource.findMany({
    where: {
      type: SourceType.RSS,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      url: true,
      name: true,
    },
  });

  return (
    sources.find((source) => extractRsshubRouteKey(source.url, mirrorOrigins) === routeKey) ?? null
  );
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

async function ensureNoRsshubRouteDuplicate(url: string, type: SourceType, excludeId?: string) {
  if (type !== SourceType.RSS) {
    return;
  }

  const routeKey = extractRsshubRouteKey(url);
  if (!routeKey) {
    return;
  }

  const existed = await findSourceByRsshubRouteKey(routeKey, excludeId);
  if (!existed) {
    return;
  }

  throw new Error(`该 RSSHub 信源已存在：${existed.name}（${existed.url}）`);
}

function compareSourcePriorityForKeep(left: {
  enabled: boolean;
  lastSuccessAt: Date | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
}, right: {
  enabled: boolean;
  lastSuccessAt: Date | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
}) {
  if (left.enabled !== right.enabled) {
    return left.enabled ? -1 : 1;
  }

  const leftSuccess = left.lastSuccessAt?.getTime() ?? 0;
  const rightSuccess = right.lastSuccessAt?.getTime() ?? 0;
  if (leftSuccess !== rightSuccess) {
    return rightSuccess - leftSuccess;
  }

  const leftChecked = left.lastCheckedAt?.getTime() ?? 0;
  const rightChecked = right.lastCheckedAt?.getTime() ?? 0;
  if (leftChecked !== rightChecked) {
    return rightChecked - leftChecked;
  }

  return left.createdAt.getTime() - right.createdAt.getTime();
}

async function mergeFeedSourceInto(
  sourceId: string,
  targetSourceId: string,
  sourceBitableRecordId: string | null,
): Promise<{ removedSources: number; movedItems: number; skippedItems: number }> {
  if (sourceId === targetSourceId) {
    return { removedSources: 0, movedItems: 0, skippedItems: 0 };
  }

  return db.$transaction(async (tx) => {
    const source = await tx.feedSource.findUnique({
      where: { id: sourceId },
      select: { id: true, bitableRecordId: true },
    });
    const target = await tx.feedSource.findUnique({
      where: { id: targetSourceId },
      select: { id: true, bitableRecordId: true },
    });

    if (!source || !target) {
      return { removedSources: 0, movedItems: 0, skippedItems: 0 };
    }

    const sourceItems = await tx.feedItem.findMany({
      where: { sourceId },
      orderBy: [{ createdAt: "asc" }],
    });

    let movedItems = 0;
    let skippedItems = 0;

    for (const item of sourceItems) {
      try {
        await tx.feedItem.create({
          data: {
            sourceId: targetSourceId,
            guid: item.guid,
            title: item.title,
            link: item.link,
            summary: item.summary,
            content: item.content,
            author: item.author,
            publishedAt: item.publishedAt,
            contentHash: item.contentHash,
            bitableRecordId: item.bitableRecordId,
            syncedToBitableAt: item.syncedToBitableAt,
          },
        });
        movedItems += 1;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          skippedItems += 1;
        } else {
          throw error;
        }
      }
    }

    await tx.feedSource.delete({
      where: { id: sourceId },
    });

    const fallbackBitableRecordId = sourceBitableRecordId || source.bitableRecordId;
    if (!target.bitableRecordId && fallbackBitableRecordId) {
      await tx.feedSource.update({
        where: { id: targetSourceId },
        data: { bitableRecordId: fallbackBitableRecordId },
      });
    }

    return {
      removedSources: 1,
      movedItems,
      skippedItems,
    };
  });
}

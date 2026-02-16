import { Prisma, SourceType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const createSourceSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().max(2048),
  type: z.nativeEnum(SourceType).default(SourceType.RSS),
  category: z.string().max(64).optional(),
  tags: z.array(z.string().max(40)).default([]),
  enabled: z.boolean().default(true),
  pollIntervalMinutes: z.number().int().min(5).max(1440).default(15),
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
      url: payload.url.trim(),
      category: payload.category?.trim() || null,
    },
  });
}

export async function updateSource(id: string, input: unknown) {
  const payload = updateSourceSchema.parse(input);
  const data: Prisma.FeedSourceUpdateInput = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.url ? { url: payload.url.trim() } : {}),
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

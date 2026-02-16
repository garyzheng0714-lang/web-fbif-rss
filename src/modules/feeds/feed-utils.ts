import type { FeedSource } from "@prisma/client";
import { normalizeWhitespace, sha256Hex, toDateOrNull } from "@/lib/utils";

const SOURCE_DUE_GRACE_MS = 60_000;

export interface ParsedFeedItem {
  guid?: string;
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  author?: string;
  pubDate?: string;
  isoDate?: string;
}

export function buildFeedGuid(sourceId: string, item: ParsedFeedItem): string {
  const maybeGuid = item.guid?.trim();
  if (maybeGuid) {
    return maybeGuid;
  }
  const fallback = `${sourceId}|${item.link ?? ""}|${item.title ?? ""}|${item.isoDate ?? item.pubDate ?? ""}`;
  return sha256Hex(fallback);
}

export function buildFeedHash(item: ParsedFeedItem): string {
  const raw = `${item.title ?? ""}|${item.link ?? ""}|${item.isoDate ?? item.pubDate ?? ""}`;
  return sha256Hex(normalizeWhitespace(raw));
}

export function toFeedSummary(item: ParsedFeedItem): string {
  const summary = item.contentSnippet ?? item.content ?? "";
  return normalizeWhitespace(summary).slice(0, 2000);
}

export function toFeedContent(item: ParsedFeedItem): string | null {
  if (!item.content) {
    return null;
  }
  const normalized = normalizeWhitespace(item.content);
  return normalized.length > 0 ? normalized.slice(0, 12000) : null;
}

export function resolvePublishedAt(item: ParsedFeedItem): Date | null {
  return toDateOrNull(item.isoDate ?? item.pubDate);
}

export function isSourceDue(source: FeedSource, now: Date): boolean {
  if (!source.enabled) {
    return false;
  }
  if (!source.lastCheckedAt) {
    return true;
  }
  const dueAt = new Date(source.lastCheckedAt.getTime() + source.pollIntervalMinutes * 60_000);
  return dueAt.getTime() - now.getTime() <= SOURCE_DUE_GRACE_MS;
}

export function splitIntoChunks<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

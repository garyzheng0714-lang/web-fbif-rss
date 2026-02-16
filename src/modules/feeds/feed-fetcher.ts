import Parser from "rss-parser";
import pLimit from "p-limit";
import { FeedSource, Prisma, SourceType } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  buildFeedGuid,
  buildFeedHash,
  isSourceDue,
  ParsedFeedItem,
  resolvePublishedAt,
  toFeedContent,
  toFeedSummary,
} from "@/modules/feeds/feed-utils";
import { buildRsshubCandidateUrls } from "@/modules/feeds/rsshub-mirror";
import { notifySourceRecovered, notifySourceUnavailable } from "@/modules/notifications/alert-service";

const parser = new Parser<Record<string, never>, ParsedFeedItem>({
  timeout: env.RSS_FETCH_TIMEOUT_MS,
});

export interface PollSourceResult {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  sourceType: SourceType;
  skipped?: boolean;
  newItems: number;
  failed: boolean;
  errorMessage?: string;
  sourceFailureCount: number;
}

export interface PollRunSummary {
  startedAt: string;
  endedAt: string;
  totalSources: number;
  attempted: number;
  successes: number;
  failures: number;
  createdItems: number;
  results: PollSourceResult[];
}

export async function runFeedPollingCycle(now = new Date()): Promise<PollRunSummary> {
  const startedAt = new Date();
  const sources = await db.feedSource.findMany({
    where: { enabled: true },
    orderBy: [{ lastCheckedAt: "asc" }, { createdAt: "asc" }],
  });

  const dueSources = sources.filter((source) => isSourceDue(source, now));
  const limit = pLimit(env.RSS_FETCH_CONCURRENCY);

  const results = await Promise.all(dueSources.map((source) => limit(() => fetchSourceAndPersist(source))));

  const summary: PollRunSummary = {
    startedAt: startedAt.toISOString(),
    endedAt: new Date().toISOString(),
    totalSources: sources.length,
    attempted: dueSources.length,
    successes: results.filter((item) => !item.failed).length,
    failures: results.filter((item) => item.failed).length,
    createdItems: results.reduce((acc, current) => acc + current.newItems, 0),
    results,
  };

  return summary;
}

async function fetchSourceAndPersist(source: FeedSource): Promise<PollSourceResult> {
  if (source.type === SourceType.WECHAT_PLACEHOLDER) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.url,
      sourceType: source.type,
      skipped: true,
      newItems: 0,
      failed: false,
      sourceFailureCount: source.failureCount,
    };
  }

  const checkedAt = new Date();
  const previousFailure = source.failureCount;

  try {
    const { feed, resolvedSourceUrl } = await parseFeedWithFallback(source.url);
    const picked = (feed.items ?? []).slice(0, env.RSS_MAX_ITEMS_PER_FETCH);
    const records = picked
      .map((item) => {
        const guid = buildFeedGuid(source.id, item);
        const title = (item.title ?? "(无标题)").trim().slice(0, 400);
        const link = (item.link ?? resolvedSourceUrl).trim().slice(0, 2048);
        return {
          sourceId: source.id,
          guid,
          title,
          link,
          summary: toFeedSummary(item),
          content: toFeedContent(item),
          author: item.author?.trim().slice(0, 120) || null,
          publishedAt: resolvePublishedAt(item),
          contentHash: buildFeedHash(item),
        };
      })
      .filter((item) => item.title && item.link);

    let createdCount = 0;
    if (records.length > 0) {
      const createResult = await db.feedItem.createMany({
        data: records,
        skipDuplicates: true,
      });
      createdCount = createResult.count;
    }

    const successUpdate = {
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastErrorAt: null,
      lastErrorMessage: null,
      failureCount: 0,
    };

    let persistedSourceUrl = source.url;
    if (resolvedSourceUrl !== source.url) {
      try {
        await db.feedSource.update({
          where: { id: source.id },
          data: {
            ...successUpdate,
            url: resolvedSourceUrl,
          },
        });
        persistedSourceUrl = resolvedSourceUrl;
      } catch (error) {
        if (isSourceUrlUniqueConflict(error)) {
          await db.feedSource.update({
            where: { id: source.id },
            data: successUpdate,
          });
        } else {
          throw error;
        }
      }
    } else {
      await db.feedSource.update({
        where: { id: source.id },
        data: successUpdate,
      });
    }

    if (previousFailure >= env.RSS_FAIL_THRESHOLD) {
      await notifySourceRecovered(source);
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: persistedSourceUrl,
      sourceType: source.type,
      newItems: createdCount,
      failed: false,
      sourceFailureCount: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown RSS fetch error";
    const nextFailureCount = previousFailure + 1;

    await db.feedSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: checkedAt,
        lastErrorAt: checkedAt,
        lastErrorMessage: errorMessage.slice(0, 1000),
        failureCount: nextFailureCount,
      },
    });

    if (previousFailure < env.RSS_FAIL_THRESHOLD && nextFailureCount >= env.RSS_FAIL_THRESHOLD) {
      await notifySourceUnavailable(source, nextFailureCount, errorMessage);
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.url,
      sourceType: source.type,
      newItems: 0,
      failed: true,
      errorMessage,
      sourceFailureCount: nextFailureCount,
    };
  }
}

async function parseFeedWithFallback(sourceUrl: string) {
  const candidates = buildRsshubCandidateUrls(sourceUrl);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const feed = await parser.parseURL(candidate);
      return {
        feed,
        resolvedSourceUrl: candidate,
      };
    } catch (error) {
      const host = safeHost(candidate);
      const message = error instanceof Error ? error.message : "Unknown RSS fetch error";
      errors.push(`${host}: ${message}`);
    }
  }

  const detail = errors.length > 0 ? errors.join(" | ") : "No available RSSHub mirror";
  throw new Error(detail.slice(0, 1000));
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function isSourceUrlUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

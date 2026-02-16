import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface ListItemsInput {
  page: number;
  pageSize: number;
  sourceId?: string;
  query?: string;
}

export async function listFeedItems(input: ListItemsInput) {
  const page = Math.max(input.page, 1);
  const pageSize = Math.min(Math.max(input.pageSize, 1), 200);
  const where = buildFeedItemWhere(input);

  const [total, items] = await Promise.all([
    db.feedItem.count({ where }),
    db.feedItem.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        source: {
          select: {
            id: true,
            name: true,
            url: true,
            type: true,
            category: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    items,
  };
}

export interface FeedItemsMarker {
  total: number;
  latestItemId: string | null;
  latestAt: string | null;
}

export async function getFeedItemsMarker(input: Pick<ListItemsInput, "sourceId" | "query">): Promise<FeedItemsMarker> {
  const where = buildFeedItemWhere(input);
  const [total, latest] = await Promise.all([
    db.feedItem.count({ where }),
    db.feedItem.findFirst({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        publishedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const latestDate = latest ? latest.publishedAt ?? latest.createdAt : null;
  return {
    total,
    latestItemId: latest?.id ?? null,
    latestAt: latestDate ? latestDate.toISOString() : null,
  };
}

function buildFeedItemWhere(input: Pick<ListItemsInput, "sourceId" | "query">): Prisma.FeedItemWhereInput {
  return {
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.query
      ? {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { summary: { contains: input.query, mode: "insensitive" } },
            { source: { name: { contains: input.query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

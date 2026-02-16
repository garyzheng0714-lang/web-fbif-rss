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
  const where = {
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
    ...(input.query
      ? {
          OR: [
            { title: { contains: input.query, mode: "insensitive" as const } },
            { summary: { contains: input.query, mode: "insensitive" as const } },
            { source: { name: { contains: input.query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

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

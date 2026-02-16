import Link from "next/link";
import { ExternalLink, Search, RefreshCcw } from "lucide-react";
import { LiveFeedAutoRefresh } from "@/components/dashboard/live-feed-auto-refresh";
import { listFeedItems } from "@/modules/feeds/item-service";
import { listSources } from "@/modules/feeds/source-service";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{
    q?: string;
    sourceId?: string;
    page?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const pageNum = Number.isNaN(page) || page < 1 ? 1 : page;

  const [sources, itemsResult] = await Promise.all([
    listSources(),
    listFeedItems({
      page: pageNum,
      pageSize: 30,
      sourceId: params.sourceId,
      query: params.q,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(itemsResult.total / itemsResult.pageSize));

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">食品行业资讯流</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              共 {itemsResult.total} 条，支持按信源和关键词筛选，点击可溯源原文。
            </p>
            <LiveFeedAutoRefresh
              initialLatestItemId={itemsResult.items[0]?.id ?? null}
              sourceId={params.sourceId}
              query={params.q}
            />
          </div>
          <form action="/api/system/run-poll" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              <RefreshCcw className="h-4 w-4" />
              立即抓取
            </button>
          </form>
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_280px_auto]" method="get">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              name="q"
              placeholder="搜索标题或摘要..."
              defaultValue={params.q ?? ""}
              className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-white pl-10 pr-3 text-sm outline-none ring-[var(--brand-500)] focus:ring-2"
            />
          </label>

          <select
            name="sourceId"
            defaultValue={params.sourceId ?? ""}
            className="h-10 rounded-lg border border-[var(--border-subtle)] bg-white px-3 text-sm outline-none ring-[var(--brand-500)] focus:ring-2"
          >
            <option value="">全部信源</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="h-10 rounded-lg bg-[var(--brand-500)] px-4 text-sm font-medium text-white hover:bg-[var(--brand-700)]"
          >
            筛选
          </button>
        </form>
      </header>

      <section className="space-y-4">
        {itemsResult.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-white p-10 text-center text-sm text-[var(--text-secondary)]">
            暂无数据，请先在“信源管理”添加 RSS 地址，或点击“立即抓取”。
          </div>
        ) : (
          itemsResult.items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 transition hover:border-[var(--brand-500)]/45"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <span className="rounded bg-[var(--brand-100)] px-2 py-1 text-[var(--brand-700)]">{item.source.name}</span>
                <span>{formatDate(item.publishedAt ?? item.createdAt)}</span>
                {item.source.category ? <span>· {item.source.category}</span> : null}
              </div>

              <h2 className="text-lg font-semibold leading-snug">
                <Link
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group/title inline-flex items-center gap-1 rounded-sm text-[var(--text-primary)] transition-all duration-200 hover:-translate-y-0.5 hover:text-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-2"
                >
                  <span className="relative after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:w-0 after:bg-[var(--brand-500)] after:transition-all after:duration-200 group-hover/title:after:w-full">
                    {item.title}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-[var(--text-tertiary)] transition-all duration-200 group-hover/title:translate-x-0.5 group-hover/title:-translate-y-0.5 group-hover/title:text-[var(--brand-700)]" />
                </Link>
              </h2>
              {item.summary ? (
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">{item.summary}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-xs text-[var(--text-tertiary)]">
                  Bitable 同步: {item.syncedToBitableAt ? "已同步" : "待同步"}
                </span>
              </div>
            </article>
          ))
        )}
      </section>

      <footer className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-white p-3 text-sm text-[var(--text-secondary)]">
        <p>
          第 {itemsResult.page} / {totalPages} 页
        </p>
        <div className="flex gap-2">
          <Link
            href={buildPageHref(Math.max(1, pageNum - 1), params.q, params.sourceId)}
            className="rounded border border-[var(--border-subtle)] px-3 py-1.5 hover:bg-[var(--bg-hover)]"
          >
            上一页
          </Link>
          <Link
            href={buildPageHref(Math.min(totalPages, pageNum + 1), params.q, params.sourceId)}
            className="rounded border border-[var(--border-subtle)] px-3 py-1.5 hover:bg-[var(--bg-hover)]"
          >
            下一页
          </Link>
        </div>
      </footer>
    </div>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function buildPageHref(page: number, q?: string, sourceId?: string): string {
  const query = new URLSearchParams();
  query.set("page", String(page));
  if (q) {
    query.set("q", q);
  }
  if (sourceId) {
    query.set("sourceId", sourceId);
  }
  return `/dashboard?${query.toString()}`;
}

"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Play, Database, ServerCog } from "lucide-react";

interface SystemStatusPayload {
  sourceTotal: number;
  sourceEnabled: number;
  itemTotal: number;
  unsyncedItems: number;
  failingSources: Array<{
    id: string;
    name: string;
    failureCount: number;
    lastErrorMessage: string | null;
    lastErrorAt: string | null;
  }>;
  recentAlerts: Array<{
    id: string;
    level: string;
    message: string;
    createdAt: string;
  }>;
  bitableItemSyncConfigured: boolean;
  bitableSourceSyncConfigured: boolean;
  rsshubMirrorAutoSwitchEnabled: boolean;
  rsshubMirrorCheckCron: string;
}

export function SystemPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SystemStatusPayload | null>(null);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/system/status", { cache: "no-store" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message ?? "加载失败");
      }
      setStatus(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function trigger(
    endpoint: "/api/system/run-poll" | "/api/system/sync-sources" | "/api/system/run-mirror-maintenance",
  ) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message ?? "执行失败");
      }
      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "执行失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={busy}
            onClick={() => void trigger("/api/system/run-poll")}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-500)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--brand-700)] disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            立即执行抓取
          </button>

          <button
            disabled={busy}
            onClick={() => void trigger("/api/system/sync-sources")}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
          >
            <Database className="h-4 w-4" />
            执行信源双向同步
          </button>

          <button
            disabled={busy}
            onClick={() => void trigger("/api/system/run-mirror-maintenance")}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
          >
            <ServerCog className="h-4 w-4" />
            执行 RSSHub 巡检
          </button>

          <button
            disabled={busy}
            onClick={() => void loadStatus()}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            刷新状态
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      </section>

      {loading || !status ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-6 text-sm text-[var(--text-secondary)]">
          加载中...
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <MetricCard title="总信源" value={status.sourceTotal} />
            <MetricCard title="启用信源" value={status.sourceEnabled} />
            <MetricCard title="总文章" value={status.itemTotal} />
            <MetricCard title="待同步到Bitable" value={status.unsyncedItems} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
              <h3 className="text-base font-semibold">失败信源</h3>
              {status.failingSources.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">暂无失败信源</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {status.failingSources.map((source) => (
                    <li key={source.id} className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                      <p className="font-medium">{source.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                        连续失败: {source.failureCount} 次
                      </p>
                      {source.lastErrorMessage ? (
                        <p className="mt-1 text-xs text-[var(--danger)] line-clamp-2">{source.lastErrorMessage}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
              <h3 className="text-base font-semibold">最近告警</h3>
              {status.recentAlerts.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">暂无告警记录</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {status.recentAlerts.map((alert) => (
                    <li key={alert.id} className="rounded-lg border border-[var(--border-subtle)] p-3 text-xs">
                      <p className="font-medium">{alert.level}</p>
                      <p className="mt-1 whitespace-pre-wrap text-[var(--text-secondary)]">{alert.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4 text-sm text-[var(--text-secondary)]">
            <StatusLine
              label="Bitable 文章同步配置"
              ok={status.bitableItemSyncConfigured}
              okText="已配置"
              badText="未配置"
            />
            <StatusLine
              label="Bitable 信源双向同步配置"
              ok={status.bitableSourceSyncConfigured}
              okText="已启用"
              badText="未启用"
              className="mt-1"
            />
            <StatusLine
              label="RSSHub 自动巡检"
              ok={status.rsshubMirrorAutoSwitchEnabled}
              okText="已启用"
              badText="未启用"
              suffix={`（${status.rsshubMirrorCheckCron}）`}
              className="mt-1"
            />
          </section>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <article className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
      <p className="text-xs text-[var(--text-tertiary)]">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function StatusLine({
  label,
  ok,
  okText,
  badText,
  suffix,
  className,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <p className={className}>
      {label}:{" "}
      <span
        className={
          ok
            ? "rounded border border-[var(--success)]/35 bg-[color-mix(in_oklab,var(--success)_12%,white)] px-2 py-0.5 text-xs text-[var(--success)]"
            : "rounded border border-[var(--text-tertiary)]/35 bg-[var(--bg-hover)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]"
        }
      >
        {ok ? okText : badText}
      </span>
      {suffix ? <span className="ml-1 text-xs text-[var(--text-tertiary)]">{suffix}</span> : null}
    </p>
  );
}

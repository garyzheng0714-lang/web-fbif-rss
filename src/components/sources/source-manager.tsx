"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedSource, SourceType } from "@prisma/client";
import { Plus, Trash2, RefreshCcw, Server, Zap } from "lucide-react";

interface SourcePayload {
  name: string;
  url: string;
  type: SourceType;
  category: string;
  tags: string;
  enabled: boolean;
  pollIntervalMinutes: number;
}

interface MirrorServer {
  origin: string;
  host: string;
  online: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  checkedAt: string;
  errorMessage?: string;
}

const initialForm: SourcePayload = {
  name: "",
  url: "",
  type: "RSS",
  category: "",
  tags: "",
  enabled: true,
  pollIntervalMinutes: 10,
};

export function SourceManager() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SourcePayload>(initialForm);
  const [mirrors, setMirrors] = useState<MirrorServer[]>([]);
  const [mirrorLoading, setMirrorLoading] = useState(true);
  const [mirrorSwitching, setMirrorSwitching] = useState(false);
  const [mirrorError, setMirrorError] = useState<string | null>(null);
  const [mirrorMessage, setMirrorMessage] = useState<string | null>(null);

  const hasWeChatSource = useMemo(
    () => sources.some((source) => source.type === "WECHAT_PLACEHOLDER"),
    [sources],
  );

  useEffect(() => {
    void loadSources();
    void loadMirrors();
  }, []);

  async function loadSources() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sources", { cache: "no-store" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message ?? "加载失败");
      }
      setSources(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadMirrors() {
    setMirrorLoading(true);
    setMirrorError(null);

    try {
      const response = await fetch("/api/sources/rsshub/servers", { cache: "no-store" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message ?? "镜像探测失败");
      }
      setMirrors(payload.data);
    } catch (caught) {
      setMirrorError(caught instanceof Error ? caught.message : "镜像探测失败");
    } finally {
      setMirrorLoading(false);
    }
  }

  async function createSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message ?? "创建失败");
      }

      setForm(initialForm);
      await loadSources();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleSource(source: FeedSource) {
    try {
      const response = await fetch(`/api/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message ?? "更新失败");
      }
      await loadSources();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失败");
    }
  }

  async function removeSource(id: string) {
    const confirmed = window.confirm("确认删除该信源？历史文章会同时删除。");
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message ?? "删除失败");
      }
      await loadSources();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败");
    }
  }

  async function switchMirror(mode: "auto" | "manual", targetOrigin?: string) {
    setMirrorSwitching(true);
    setMirrorError(null);
    setMirrorMessage(null);

    try {
      const response = await fetch("/api/sources/rsshub/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, targetOrigin }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.message ?? "切换失败");
      }

      const summary = payload.data?.summary;
      const selectedOrigin = payload.data?.selected?.origin as string | undefined;
      const updated = typeof summary?.updated === "number" ? summary.updated : 0;
      const conflicts = typeof summary?.conflicts === "number" ? summary.conflicts : 0;
      const failed = typeof summary?.failed === "number" ? summary.failed : 0;

      setMirrorMessage(
        `已切换到 ${selectedOrigin ?? "目标服务器"}，更新 ${updated} 条信源，冲突 ${conflicts}，失败 ${failed}。`,
      );

      await Promise.all([loadSources(), loadMirrors()]);
    } catch (caught) {
      setMirrorError(caught instanceof Error ? caught.message : "切换失败");
    } finally {
      setMirrorSwitching(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="inline-flex items-center gap-2 text-base font-semibold">
              <Server className="h-4 w-4" />
              RSSHub 服务器切换
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              探测在线状态后，可一键切换所有 RSSHub 信源到目标服务器。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadMirrors()}
              disabled={mirrorLoading || mirrorSwitching}
              className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              刷新服务器状态
            </button>
            <button
              onClick={() => void switchMirror("auto")}
              disabled={mirrorLoading || mirrorSwitching || mirrors.length === 0}
              className="inline-flex items-center gap-1 rounded bg-[var(--brand-500)] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-700)] disabled:opacity-60"
            >
              <Zap className="h-3.5 w-3.5" />
              自动切换最快可用
            </button>
          </div>
        </div>

        {mirrorError ? <p className="mt-3 text-sm text-[var(--danger)]">{mirrorError}</p> : null}
        {mirrorMessage ? <p className="mt-3 text-sm text-[var(--success)]">{mirrorMessage}</p> : null}

        {mirrorLoading ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">正在探测 RSSHub 服务器...</p>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-tertiary)]">
                  <th className="px-2 py-2">服务器</th>
                  <th className="px-2 py-2">在线</th>
                  <th className="px-2 py-2">耗时</th>
                  <th className="px-2 py-2">状态码</th>
                  <th className="px-2 py-2">最近探测</th>
                  <th className="px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {mirrors.map((mirror) => (
                  <tr key={mirror.origin} className="border-b border-[var(--border-subtle)]">
                    <td className="px-2 py-2">
                      <p className="font-medium">{mirror.host}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{mirror.origin}</p>
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          mirror.online
                            ? "rounded border border-[var(--success)]/35 bg-[color-mix(in_oklab,var(--success)_12%,white)] px-2 py-1 text-xs text-[var(--success)]"
                            : "rounded border border-[var(--danger)]/35 bg-[color-mix(in_oklab,var(--danger)_10%,white)] px-2 py-1 text-xs text-[var(--danger)]"
                        }
                      >
                        {mirror.online ? "在线" : "离线"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-[var(--text-secondary)]">
                      {mirror.latencyMs === null ? "-" : `${mirror.latencyMs} ms`}
                    </td>
                    <td className="px-2 py-2 text-xs text-[var(--text-secondary)]">
                      {mirror.statusCode ?? "-"}
                    </td>
                    <td className="px-2 py-2 text-xs text-[var(--text-secondary)]">
                      {formatDateTime(mirror.checkedAt)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => void switchMirror("manual", mirror.origin)}
                        disabled={mirrorSwitching || !mirror.online}
                        className="rounded border border-[var(--border-subtle)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)] disabled:opacity-50"
                      >
                        切换到此服务器
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form onSubmit={createSource} className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <h2 className="text-base font-semibold">新增信源</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
            placeholder="信源名称"
            className="h-10 rounded-lg border border-[var(--border-subtle)] px-3 text-sm outline-none ring-[var(--brand-500)] focus:ring-2"
          />
          <input
            value={form.url}
            onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
            required
            placeholder="https://example.com/rss.xml"
            className="h-10 rounded-lg border border-[var(--border-subtle)] px-3 text-sm outline-none ring-[var(--brand-500)] focus:ring-2"
          />
          <select
            value={form.type}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, type: event.target.value as SourceType }))
            }
            className="h-10 rounded-lg border border-[var(--border-subtle)] px-3 text-sm"
          >
            <option value="RSS">RSS</option>
            <option value="WECHAT_PLACEHOLDER">微信公众号（占位）</option>
          </select>
          <input
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="分类（如：饮料、乳业）"
            className="h-10 rounded-lg border border-[var(--border-subtle)] px-3 text-sm outline-none ring-[var(--brand-500)] focus:ring-2"
          />
          <input
            value={form.tags}
            onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            placeholder="标签，用逗号分隔"
            className="h-10 rounded-lg border border-[var(--border-subtle)] px-3 text-sm outline-none ring-[var(--brand-500)] focus:ring-2"
          />
          <input
            value={form.pollIntervalMinutes}
            type="number"
            min={5}
            max={1440}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                pollIntervalMinutes: Number.parseInt(event.target.value || "10", 10),
              }))
            }
            placeholder="轮询分钟"
            className="h-10 rounded-lg border border-[var(--border-subtle)] px-3 text-sm outline-none ring-[var(--brand-500)] focus:ring-2"
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            创建后立即启用
          </label>

          <button
            disabled={submitting}
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-500)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--brand-700)] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            添加信源
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-[var(--border-subtle)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">信源列表</h2>
          <button
            onClick={() => void loadSources()}
            className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>

        {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">加载中...</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-[var(--text-tertiary)]">
                  <th className="px-2 py-2">名称</th>
                  <th className="px-2 py-2">类型</th>
                  <th className="px-2 py-2">分类</th>
                  <th className="px-2 py-2">轮询</th>
                  <th className="px-2 py-2">上次刷新</th>
                  <th className="px-2 py-2">状态</th>
                  <th className="px-2 py-2">开关</th>
                  <th className="px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id} className="border-b border-[var(--border-subtle)] align-top">
                    <td className="px-2 py-2">
                      <p className="font-medium">{source.name}</p>
                      <p className="max-w-[320px] truncate text-xs text-[var(--text-tertiary)]">{source.url}</p>
                    </td>
                    <td className="px-2 py-2">{source.type === "RSS" ? "RSS" : "公众号占位"}</td>
                    <td className="px-2 py-2">{source.category ?? "-"}</td>
                    <td className="px-2 py-2">{source.pollIntervalMinutes} 分钟</td>
                    <td className="px-2 py-2 text-xs text-[var(--text-secondary)]">
                      {formatDateTime(source.lastCheckedAt)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          source.enabled
                            ? "rounded border border-[var(--success)]/35 bg-[color-mix(in_oklab,var(--success)_12%,white)] px-2 py-1 text-xs text-[var(--success)]"
                            : "rounded border border-[var(--text-tertiary)]/35 bg-[var(--bg-hover)] px-2 py-1 text-xs text-[var(--text-tertiary)]"
                        }
                      >
                        {source.enabled ? "已启用" : "已停用"}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => void toggleSource(source)}
                        className={
                          source.enabled
                            ? "rounded border border-[var(--danger)]/35 bg-[color-mix(in_oklab,var(--danger)_10%,white)] px-2 py-1 text-xs text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_14%,white)]"
                            : "rounded border border-[var(--success)]/35 bg-[color-mix(in_oklab,var(--success)_12%,white)] px-2 py-1 text-xs text-[var(--success)] hover:bg-[color-mix(in_oklab,var(--success)_18%,white)]"
                        }
                      >
                        {source.enabled ? "停用" : "启用"}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => void removeSource(source.id)}
                        className="inline-flex items-center gap-1 rounded border border-[var(--danger)]/35 px-2 py-1 text-xs text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_10%,white)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasWeChatSource ? (
          <p className="mt-3 rounded-lg border border-[var(--warn)]/30 bg-[color-mix(in_oklab,var(--warn)_12%,white)] p-2 text-xs text-[var(--text-secondary)]">
            已检测到“微信公众号占位”信源。当前仅占位，不会抓取；收到你后续 API 文档后可无缝接入。
          </p>
        ) : null}
      </section>
    </div>
  );
}

function formatDateTime(value: string | Date | null): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedSource, SourceType } from "@prisma/client";
import { Plus, Trash2, RefreshCcw } from "lucide-react";

interface SourcePayload {
  name: string;
  url: string;
  type: SourceType;
  category: string;
  tags: string;
  enabled: boolean;
  pollIntervalMinutes: number;
}

const initialForm: SourcePayload = {
  name: "",
  url: "",
  type: "RSS",
  category: "",
  tags: "",
  enabled: true,
  pollIntervalMinutes: 15,
};

export function SourceManager() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SourcePayload>(initialForm);

  const hasWeChatSource = useMemo(
    () => sources.some((source) => source.type === "WECHAT_PLACEHOLDER"),
    [sources],
  );

  useEffect(() => {
    void loadSources();
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

  return (
    <div className="space-y-4">
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
                pollIntervalMinutes: Number.parseInt(event.target.value || "15", 10),
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
                  <th className="px-2 py-2">状态</th>
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
                    <td className="px-2 py-2">
                      <button
                        onClick={() => void toggleSource(source)}
                        className="rounded border border-[var(--border-subtle)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]"
                      >
                        {source.enabled ? "启用" : "停用"}
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

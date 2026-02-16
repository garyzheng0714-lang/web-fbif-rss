"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

interface LiveFeedAutoRefreshProps {
  initialLatestItemId: string | null;
  sourceId?: string;
  query?: string;
  pollIntervalMs?: number;
}

export function LiveFeedAutoRefresh({
  initialLatestItemId,
  sourceId,
  query,
  pollIntervalMs = 10_000,
}: LiveFeedAutoRefreshProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const latestItemIdRef = useRef<string | null>(initialLatestItemId);
  const inFlightRef = useRef(false);

  const markerUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("mode", "marker");
    if (sourceId) {
      params.set("sourceId", sourceId);
    }
    if (query) {
      params.set("q", query);
    }
    return `/api/items?${params.toString()}`;
  }, [query, sourceId]);

  useEffect(() => {
    latestItemIdRef.current = initialLatestItemId;
  }, [initialLatestItemId]);

  useEffect(() => {
    let mounted = true;

    async function checkForUpdates() {
      if (!mounted || inFlightRef.current || document.hidden) {
        return;
      }

      inFlightRef.current = true;
      try {
        const response = await fetch(markerUrl, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          ok?: boolean;
          data?: { latestItemId?: string | null };
        };
        if (!payload.ok) {
          return;
        }

        const latestItemId = payload.data?.latestItemId ?? null;
        if (latestItemId !== latestItemIdRef.current) {
          latestItemIdRef.current = latestItemId;
          startTransition(() => {
            router.refresh();
          });
        }
      } finally {
        inFlightRef.current = false;
      }
    }

    const timer = window.setInterval(() => {
      void checkForUpdates();
    }, pollIntervalMs);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [markerUrl, pollIntervalMs, router, startTransition]);

  return (
    <p className="mt-1 text-xs text-[var(--text-tertiary)]">实时更新已开启（每 {Math.max(1, Math.floor(pollIntervalMs / 1000))} 秒检查）</p>
  );
}

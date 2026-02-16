import { SystemPanel } from "@/components/system/system-panel";

export default function SystemPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">系统监控</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          查看抓取状态、失败信源、告警历史，并可手动触发抓取和双向同步。
        </p>
      </header>

      <SystemPanel />
    </div>
  );
}

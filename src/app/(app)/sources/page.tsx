import { SourceManager } from "@/components/sources/source-manager";

export default function SourcesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">信源管理</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          支持 RSS 信源的新增、编辑和启停。微信公众号信源接口预留，后续可按 API 文档接入。
        </p>
      </header>

      <SourceManager />
    </div>
  );
}

import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import { env } from "@/lib/env";

interface LoginPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-white shadow-xl md:grid-cols-2">
        <section className="bg-[linear-gradient(155deg,#1456f0,#0f3ca5)] p-8 text-white md:p-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/30 px-3 py-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Feishu OAuth 登录
          </p>
          <h1 className="mt-5 text-3xl font-semibold leading-tight md:text-4xl">FBIF 食品行业 RSS 情报中心</h1>
          <p className="mt-4 text-sm text-white/85 md:text-base">
            支持多信源采集、飞书告警、Bitable 同步和 Docker 部署迁移。登录后可直接管理信源并浏览资讯流。
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            <li>• 支持 RSS 与公众号信源（公众号模块当前占位）</li>
            <li>• 信源异常自动飞书告警</li>
            <li>• 资讯去重后同步到多维表格</li>
          </ul>
        </section>

        <section className="p-8 md:p-10">
          <h2 className="text-2xl font-semibold">登录系统</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            使用飞书账号登录。首次登录会自动创建站内账户并绑定身份。
          </p>

          {error ? (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--warn)]/30 bg-[color-mix(in_oklab,var(--warn)_12%,white)] p-3 text-sm text-[var(--text-primary)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--warn)]" />
              <div>
                <p className="font-medium">登录失败</p>
                <p className="mt-1 break-all text-xs text-[var(--text-secondary)]">{decodeURIComponent(error)}</p>
              </div>
            </div>
          ) : null}

          <Link
            href="/api/auth/feishu/start"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-500)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--brand-700)]"
          >
            使用飞书登录
            <ArrowRight className="h-4 w-4" />
          </Link>

          {env.DEV_AUTH_BYPASS_ENABLED ? (
            <Link
              href="/api/auth/dev-login"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-page)]"
            >
              本地开发登录
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}

          <div className="mt-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] p-3 text-xs text-[var(--text-tertiary)]">
            若出现 redirect_uri 错误，请先访问
            <code className="mx-1 rounded bg-white px-1 py-0.5">/api/auth/feishu/debug</code>
            检查回调地址是否与飞书后台配置完全一致。
          </div>
        </section>
      </div>
    </div>
  );
}

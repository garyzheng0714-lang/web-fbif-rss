"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, Rss, Settings, LogOut } from "lucide-react";
import clsx from "clsx";

interface AppShellProps {
  user: {
    name: string;
    openId: string;
  };
  children: React.ReactNode;
}

const navItems = [
  { href: "/dashboard", label: "资讯流", icon: Newspaper },
  { href: "/sources", label: "信源管理", icon: Rss },
  { href: "/system", label: "系统监控", icon: Settings },
];

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      <div className="mx-auto flex max-w-[1560px] gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-72 shrink-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 shadow-sm lg:flex lg:flex-col">
          <div className="mb-6 rounded-xl bg-[linear-gradient(135deg,var(--brand-500),#0f3ca5)] p-4 text-white">
            <p className="text-sm opacity-85">FBIF Food RSS</p>
            <h1 className="mt-1 text-xl font-semibold">行业情报中心</h1>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-[var(--brand-100)] text-[var(--brand-700)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-[var(--border-subtle)] bg-white p-3">
            <p className="text-xs text-[var(--text-tertiary)]">当前登录</p>
            <p className="mt-1 truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-[var(--text-tertiary)]">{user.openId}</p>
            <form action="/api/auth/logout" method="post" className="mt-3">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                <LogOut className="h-3.5 w-3.5" />
                退出登录
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-2 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-white p-2 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs whitespace-nowrap transition",
                    active
                      ? "bg-[var(--brand-100)] text-[var(--brand-700)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
            <form action="/api/auth/logout" method="post" className="ml-auto">
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2 py-2 text-xs text-[var(--text-secondary)]"
              >
                <LogOut className="h-3.5 w-3.5" />
                退出
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4 shadow-sm md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

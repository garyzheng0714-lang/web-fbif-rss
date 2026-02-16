import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/modules/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireCurrentUser();

  return (
    <AppShell
      user={{
        name: user.name,
        openId: user.openId,
      }}
    >
      {children}
    </AppShell>
  );
}

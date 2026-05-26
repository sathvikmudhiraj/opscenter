import type { UserRole } from "@/types/auth";
import { Sidebar } from "./Sidebar";
import { RoleGuard } from "./RoleGuard";
import { NotificationBell } from "./NotificationBell";

export function DashboardShell({ role, title, subtitle, children }: { role: UserRole; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <RoleGuard role={role}>
      <div className="min-h-screen bg-[#eef3f8] lg:flex">
        <div className="hidden lg:block">
          <Sidebar role={role} />
        </div>
        <main className="flex-1">
          <header className="border-b border-slate-200 bg-white/80 px-5 py-5 backdrop-blur lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">{role} operations</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
                <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
              </div>
              <NotificationBell />
            </div>
          </header>
          <div className="px-5 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </RoleGuard>
  );
}

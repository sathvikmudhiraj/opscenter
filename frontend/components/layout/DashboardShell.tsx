"use client";

import type { UserRole } from "@/types/auth";
import { MobileNav, Sidebar } from "./Sidebar";
import { RoleGuard } from "./RoleGuard";
import { NotificationBell } from "./NotificationBell";

export function DashboardShell({ role, title, subtitle, children, hideNotifications = false }: { role: UserRole; title: string; subtitle: string; children: React.ReactNode; hideNotifications?: boolean }) {
  return (
    <RoleGuard role={role}>
      <div className="min-h-screen bg-[#eef3f8] lg:flex">
        <div className="hidden lg:block">
          <Sidebar role={role} />
        </div>
        <main className="flex-1">
          <header className="relative z-40 border-b border-slate-200 bg-white/80 px-5 py-5 backdrop-blur lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">{role} operations</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
                <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
              </div>
              {hideNotifications ? null : <NotificationBell />}
            </div>
          </header>
          <MobileNav role={role} />
          <div className="px-5 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </RoleGuard>
  );
}

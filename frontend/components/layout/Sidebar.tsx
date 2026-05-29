"use client";

import { BarChart3, Bell, Boxes, ClipboardList, FileBarChart, FileClock, Gauge, HardHat, History, KeyRound, LogOut, Settings, UserCog } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";
import type { UserRole } from "@/types/auth";
import { SidebarUserCard } from "./SidebarUserCard";

export const roleItems = {
  employee: [
    { href: "/employee/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/employee/raise-ticket", label: "Raise Ticket", icon: ClipboardList },
    { href: "/employee/my-tickets", label: "My Tickets", icon: ClipboardList },
    { href: "/employee/assets", label: "Assets", icon: Boxes },
    { href: "/employee/notifications", label: "Notifications", icon: Bell }
  ],
  engineer: [
    { href: "/engineer/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/engineer/assigned-tickets", label: "Assigned Tickets", icon: ClipboardList },
    { href: "/engineer/notifications", label: "Notifications", icon: Bell }
  ],
  admin: [
    { href: "/admin/dashboard", label: "Command Center", icon: BarChart3 },
    { href: "/admin/tickets", label: "Ticket Management", icon: ClipboardList },
    { href: "/admin/users", label: "User Management", icon: UserCog },
    { href: "/admin/password-resets", label: "Password Reset Requests", icon: KeyRound },
    { href: "/admin/engineers", label: "Engineer Management", icon: HardHat },
    { href: "/admin/assets", label: "Asset Management", icon: Boxes },
    { href: "/admin/asset-requests", label: "Asset Requests", icon: FileClock },
    { href: "/admin/sla", label: "SLA Monitoring", icon: Gauge },
    { href: "/admin/notifications", label: "Notifications", icon: Bell },
    { href: "/admin/reports", label: "Reports & Analytics", icon: FileBarChart },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: History },
    { href: "/admin/settings", label: "Settings", icon: Settings }
  ]
};

export function Sidebar({ role }: { role: UserRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const items = roleItems[role];

  return (
    <aside className="sticky top-0 flex h-screen w-72 flex-col overflow-y-auto bg-slate-950 px-4 py-5 text-slate-100">
      <div className="mb-8 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">OpsCenter</p>
        <h2 className="mt-2 text-xl font-semibold">PC Support Ops</h2>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== `/${role}/dashboard` && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition ${
                active ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3 pt-5">
        <SidebarUserCard role={role} />
        <button
          className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          onClick={() => {
            clearSession();
            router.replace("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = roleItems[role];

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== `/${role}/dashboard` && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
              active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

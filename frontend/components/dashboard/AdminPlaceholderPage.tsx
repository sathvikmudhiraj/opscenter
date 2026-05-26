import type { LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";

export function AdminPlaceholderPage({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: LucideIcon; children?: React.ReactNode }) {
  return (
    <DashboardShell role="admin" title={title} subtitle={subtitle}>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="rounded-md bg-blue-50 p-3 text-blue-700">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
          </div>
        </div>
      </section>
      {children}
    </DashboardShell>
  );
}

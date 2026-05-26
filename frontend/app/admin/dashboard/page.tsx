import { Activity, ShieldCheck, Tickets, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TicketTable } from "@/components/dashboard/TicketTable";
import { UserRoleManager } from "@/components/dashboard/UserRoleManager";

export default function AdminDashboard() {
  return (
    <DashboardShell role="admin" title="Operations Command Center" subtitle="Control users, support capacity, assets, security posture, and enterprise service levels.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total tickets" value="246" detail="41 opened this week" icon={Tickets} />
        <KpiCard label="Active users" value="1,284" detail="Across employee and support roles" icon={Users} tone="cyan" />
        <KpiCard label="SLA compliance" value="96%" detail="Above monthly target" icon={Activity} tone="green" />
        <KpiCard label="Security events" value="2" detail="Role guard denials reviewed" icon={ShieldCheck} tone="amber" />
      </div>
      <UserRoleManager />
      <TicketTable />
    </DashboardShell>
  );
}

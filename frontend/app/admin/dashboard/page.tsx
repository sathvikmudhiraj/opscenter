import { DashboardShell } from "@/components/layout/DashboardShell";
import { TicketTable } from "@/components/dashboard/TicketTable";
import { UserRoleManager } from "@/components/dashboard/UserRoleManager";
import { AdminMetrics } from "@/components/dashboard/AdminMetrics";

export default function AdminDashboard() {
  return (
    <DashboardShell role="admin" title="Operations Command Center" subtitle="Control users, support capacity, assets, security posture, and enterprise service levels.">
      <AdminMetrics />
      <UserRoleManager />
      <TicketTable />
    </DashboardShell>
  );
}

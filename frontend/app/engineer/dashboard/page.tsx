import { DashboardShell } from "@/components/layout/DashboardShell";
import { EngineerDashboardClient } from "@/components/dashboard/EngineerDashboardClient";

export default function EngineerDashboard() {
  return (
    <DashboardShell role="engineer" title="Engineer Workbench" subtitle="Triage assigned incidents, update tickets, and resolve PC support tasks.">
      <EngineerDashboardClient />
    </DashboardShell>
  );
}

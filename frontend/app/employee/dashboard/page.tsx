import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmployeeDashboardClient } from "@/components/dashboard/EmployeeDashboardClient";

export default function EmployeeDashboard() {
  return (
    <DashboardShell role="employee" title="Employee Support Desk" subtitle="Submit requests, track assigned assets, and monitor support progress.">
      <EmployeeDashboardClient />
    </DashboardShell>
  );
}

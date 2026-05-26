import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmployeeMyTickets } from "@/components/tickets/EmployeeMyTickets";

export default function EmployeeMyTicketsPage() {
  return (
    <DashboardShell role="employee" title="My Tickets" subtitle="Monitor support progress, assigned engineer, and ticket history.">
      <EmployeeMyTickets />
    </DashboardShell>
  );
}

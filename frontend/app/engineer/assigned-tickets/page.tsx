import { DashboardShell } from "@/components/layout/DashboardShell";
import { EngineerAssignedTickets } from "@/components/tickets/EngineerAssignedTickets";

export default function EngineerAssignedTicketsPage() {
  return (
    <DashboardShell role="engineer" title="Assigned Tickets" subtitle="Work only the tickets assigned to your engineer queue.">
      <EngineerAssignedTickets />
    </DashboardShell>
  );
}

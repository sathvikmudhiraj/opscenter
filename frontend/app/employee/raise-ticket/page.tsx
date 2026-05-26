import { DashboardShell } from "@/components/layout/DashboardShell";
import { RaiseTicketForm } from "@/components/tickets/RaiseTicketForm";

export default function RaiseTicketPage() {
  return (
    <DashboardShell role="employee" title="Raise Ticket" subtitle="Submit a support complaint with asset context and screenshot evidence.">
      <RaiseTicketForm />
    </DashboardShell>
  );
}

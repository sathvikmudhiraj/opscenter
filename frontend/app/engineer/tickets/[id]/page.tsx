import { DashboardShell } from "@/components/layout/DashboardShell";
import { EngineerTicketWorkbench } from "@/components/tickets/EngineerTicketWorkbench";

type EngineerTicketPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EngineerTicketPage({ params }: EngineerTicketPageProps) {
  const { id } = await params;

  return (
    <DashboardShell role="engineer" title="Engineer Ticket Workbench" subtitle="Record root cause, corrective action, service evidence, and final status.">
      <EngineerTicketWorkbench id={id} />
    </DashboardShell>
  );
}

import { TicketDetailRoute } from "@/components/tickets/TicketDetailRoute";

type TicketDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TicketDetailPage({
  params,
}: TicketDetailPageProps) {
  const { id } = await params;

  return <TicketDetailRoute id={id} />;
}

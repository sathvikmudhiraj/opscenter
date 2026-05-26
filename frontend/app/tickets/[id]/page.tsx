import { TicketDetailView } from "@/components/tickets/TicketDetailView";

type TicketDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TicketDetailPage({
  params,
}: TicketDetailPageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#eef3f8] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <TicketDetailView id={id} />
      </div>
    </main>
  );
}
import { ClipboardList } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { AdminTicketManagement } from "@/components/tickets/AdminTicketManagement";

export default function AdminTicketsPage() {
  return (
    <AdminPlaceholderPage title="Ticket Management" subtitle="Review, prioritize, assign, and track all support tickets across the organization." icon={ClipboardList}>
      <AdminTicketManagement />
    </AdminPlaceholderPage>
  );
}

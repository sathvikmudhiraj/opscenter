import { Bell } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function AdminNotificationsPage() {
  return (
    <AdminPlaceholderPage title="Notifications" subtitle="Review system notifications, ticket alerts, assignment messages, and escalation events." icon={Bell}>
      <NotificationList />
    </AdminPlaceholderPage>
  );
}

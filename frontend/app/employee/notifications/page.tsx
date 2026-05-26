import { DashboardShell } from "@/components/layout/DashboardShell";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function EmployeeNotificationsPage() {
  return (
    <DashboardShell role="employee" title="Notifications" subtitle="Review ticket assignments, status updates, and resolved ticket alerts.">
      <NotificationList />
    </DashboardShell>
  );
}

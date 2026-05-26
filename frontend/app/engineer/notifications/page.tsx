import { DashboardShell } from "@/components/layout/DashboardShell";
import { NotificationList } from "@/components/notifications/NotificationList";

export default function EngineerNotificationsPage() {
  return (
    <DashboardShell role="engineer" title="Engineer Notifications" subtitle="Review assigned ticket alerts, escalations, and service workflow updates.">
      <NotificationList />
    </DashboardShell>
  );
}

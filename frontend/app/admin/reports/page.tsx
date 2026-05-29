import { FileBarChart } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { AdminReportsClient } from "@/components/dashboard/AdminReportsClient";

export default function AdminReportsPage() {
  return (
    <AdminPlaceholderPage title="Reports & Analytics" subtitle="Analyze ticket volume, engineer performance, asset usage, SLA compliance, and operational trends." icon={FileBarChart}>
      <AdminReportsClient />
    </AdminPlaceholderPage>
  );
}

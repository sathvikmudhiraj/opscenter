import { FileBarChart } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";

export default function AdminReportsPage() {
  return <AdminPlaceholderPage title="Reports & Analytics" subtitle="Analyze ticket volume, engineer performance, asset usage, SLA compliance, and operational trends." icon={FileBarChart} />;
}

import { HardHat } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { EngineerManagement } from "@/components/engineers/EngineerManagement";

export default function AdminEngineersPage() {
  return (
    <AdminPlaceholderPage title="Engineer Management" subtitle="Manage engineer availability, workload, assignments, and escalation coverage." icon={HardHat}>
      <EngineerManagement />
    </AdminPlaceholderPage>
  );
}

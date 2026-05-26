import { History } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { AuditLogTable } from "@/components/dashboard/AuditLogTable";

export default function AdminAuditLogsPage() {
  return (
    <AdminPlaceholderPage title="Audit Logs" subtitle="Inspect administrative actions, role changes, ticket updates, and security-relevant events." icon={History}>
      <AuditLogTable />
    </AdminPlaceholderPage>
  );
}

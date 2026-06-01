import { Network } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { InfrastructureMonitoringPage } from "@/components/dashboard/InfrastructureMonitoringPage";

export default function AdminInfrastructurePage() {
  return (
    <AdminPlaceholderPage title="Infrastructure Monitoring" subtitle="Enterprise NOC visibility for intranet, webmail, and network health." icon={Network}>
      <InfrastructureMonitoringPage />
    </AdminPlaceholderPage>
  );
}

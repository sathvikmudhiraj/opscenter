import { FileClock } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { AssetRequestManager } from "@/components/assets/AssetRequestManager";

export default function AdminAssetRequestsPage() {
  return (
    <AdminPlaceholderPage title="Asset Requests" subtitle="Review engineer and employee asset requests, approve fulfillment, and monitor request history." icon={FileClock}>
      <AssetRequestManager />
    </AdminPlaceholderPage>
  );
}

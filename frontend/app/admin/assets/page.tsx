import { Boxes } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { AssetInventory } from "@/components/assets/AssetInventory";

export default function AdminAssetsPage() {
  return (
    <AdminPlaceholderPage title="Asset Management" subtitle="Track PC inventory, asset ownership, repair status, locations, and lifecycle state." icon={Boxes}>
      <AssetInventory mode="admin" />
    </AdminPlaceholderPage>
  );
}

import { DashboardShell } from "@/components/layout/DashboardShell";
import { AssetInventory } from "@/components/assets/AssetInventory";

export default function EmployeeAssetsPage() {
  return (
    <DashboardShell role="employee" title="My Assets" subtitle="View assigned devices and asset context used while raising support tickets.">
      <AssetInventory mode="employee" />
    </DashboardShell>
  );
}

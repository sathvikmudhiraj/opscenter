import { Settings } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";

export default function AdminSettingsPage() {
  return <AdminPlaceholderPage title="Settings" subtitle="Configure OpsCenter preferences, security behavior, role policy, and operational defaults." icon={Settings} />;
}

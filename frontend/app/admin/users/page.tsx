import { UserCog } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { UserRoleManager } from "@/components/dashboard/UserRoleManager";

export default function AdminUsersPage() {
  return (
    <AdminPlaceholderPage title="User Management" subtitle="Manage employees, engineers, admin access, and role assignment." icon={UserCog}>
      <UserRoleManager />
    </AdminPlaceholderPage>
  );
}

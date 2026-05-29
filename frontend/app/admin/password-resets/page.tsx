import { KeyRound } from "lucide-react";
import { AdminPlaceholderPage } from "@/components/dashboard/AdminPlaceholderPage";
import { PasswordResetRequests } from "@/components/dashboard/PasswordResetRequests";

export default function AdminPasswordResetsPage() {
  return (
    <AdminPlaceholderPage title="Password Reset Requests" subtitle="Approve, reject, and complete secure user password reset workflows." icon={KeyRound}>
      <PasswordResetRequests />
    </AdminPlaceholderPage>
  );
}

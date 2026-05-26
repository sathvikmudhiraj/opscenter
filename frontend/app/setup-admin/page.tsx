import { AuthCard } from "@/components/auth/AuthCard";
import { SetupAdminForm } from "@/components/auth/AuthForm";

export default function SetupAdminPage() {
  return (
    <AuthCard title="Create first admin" subtitle="This setup screen is available only while the USERS table is empty.">
      <SetupAdminForm />
    </AuthCard>
  );
}

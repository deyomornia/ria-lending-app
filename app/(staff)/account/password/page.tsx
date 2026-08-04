import { requireStaff } from "@/lib/auth/staff";
import { PageHeader } from "@/components/staff/PageHeader";
import { ChangePasswordForm } from "@/components/staff/ChangePasswordForm";

export const metadata = { title: "Change Password — RIA Lending" };

export default async function ChangePasswordPage() {
  const { user } = await requireStaff();

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Change password"
        description={`Signed in as ${user.email}`}
      />
      <ChangePasswordForm email={user.email ?? ""} />
    </div>
  );
}

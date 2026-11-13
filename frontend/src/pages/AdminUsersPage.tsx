import type { ReactElement } from "react";

import { PartHeader } from "@/components/PartHeader";
import { AdminUsers } from "@/features/admin/components/AdminUsers";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";

/** /admin/users: everyone with an account. */
export function AdminUsersPage(): ReactElement {
  const users = useAdminUsers();
  return (
    <>
      <title>Users · Admin · Seghan</title>
      <PartHeader
        title="Users"
        description="Everyone with an account, the newest first."
        className="mb-6"
      />
      <AdminUsers {...users} />
    </>
  );
}

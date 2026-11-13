import type { ReactElement } from "react";

import { AdminUsers } from "@/features/admin/components/AdminUsers";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";

/** /admin/users: everyone with an account. */
export function AdminUsersPage(): ReactElement {
  const users = useAdminUsers();
  return (
    <>
      <title>Users · Admin · Seghan</title>
      <h2 className="sr-only">Users</h2>
      <AdminUsers {...users} />
    </>
  );
}

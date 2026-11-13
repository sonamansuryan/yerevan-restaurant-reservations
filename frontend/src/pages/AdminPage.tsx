import type { ReactElement } from "react";
import { Outlet } from "react-router";

import { OfficeAccount } from "@/components/OfficeAccount";
import { OfficeLayout } from "@/components/OfficeLayout";
import { AdminNav } from "@/features/admin/components/AdminNav";
import { useAccount } from "@/features/auth/hooks/useAccount";

/**
 * Seghan's admin area, the same back room as the owner's dashboard: its dark menu down the left,
 * beside the part that's open, or above it on a phone.
 */
export function AdminPage(): ReactElement {
  const account = useAccount();
  return (
    <OfficeLayout nav={<AdminNav account={<OfficeAccount account={account} />} />}>
      <Outlet />
    </OfficeLayout>
  );
}

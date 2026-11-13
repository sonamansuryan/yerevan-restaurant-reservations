import type { ReactElement } from "react";
import { Outlet } from "react-router";

import { PageContainer } from "@/components/PageContainer";
import { AdminHeader } from "@/features/admin/components/AdminHeader";

/** Seghan's admin area: its heading and the row of its parts, with the part that's open below. */
export function AdminPage(): ReactElement {
  return (
    <PageContainer className="py-section-sm">
      <AdminHeader />
      <div className="mt-10">
        <Outlet />
      </div>
    </PageContainer>
  );
}

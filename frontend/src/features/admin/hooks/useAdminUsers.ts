import { useState } from "react";

import { readUserFilters } from "@/features/admin/admin";
import type { AdminUserFilters } from "@/features/admin/admin";
import type { AdminUsersProps } from "@/features/admin/components/AdminUsers";
import { useAdminList } from "@/features/admin/hooks/useAdminList";
import { yerevanToday } from "@/lib/time";
import type { AdminUser } from "@/types/api";

/** Everyone with an account, /admin/users, filtered as the address says. */
export function useAdminUsers(): AdminUsersProps {
  const part = useAdminList<AdminUser, AdminUserFilters>("users", readUserFilters);
  // Read once, when the page opens, so the days don't change under someone at midnight.
  const [today] = useState(() => yerevanToday());
  return { ...part, today };
}

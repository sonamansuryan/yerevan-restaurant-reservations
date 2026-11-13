import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { PlusIcon } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { PartHeader } from "@/components/PartHeader";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoTablesYet,
} from "@/features/dashboard/components/DashboardStates";
import { FloorPlan } from "@/features/dashboard/components/FloorPlan";
import { TableForm } from "@/features/dashboard/components/TableForm";
import { TableList } from "@/features/dashboard/components/TableList";
import { useBlocks } from "@/features/dashboard/hooks/useBlocks";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useDayReservations } from "@/features/dashboard/hooks/useDayReservations";
import { useAddTable, useTables, useUpdateTable } from "@/features/dashboard/hooks/useTables";
import { NEW_TABLE, tableFields, tableNow, tablesSummary } from "@/features/dashboard/tables";
import { yerevanClock, yerevanToday } from "@/lib/time";

/**
 * A restaurant's tables, as the export has them: the floor plan, each table as it stands now, beside
 * the list of every table, where one is added, changed, or switched off or back on. Now moves on
 * each minute, and today's bookings are asked for again every 30 seconds, as on Reservations.
 */
export function DashboardTablesPage(): ReactElement {
  const restaurant = useDashboardRestaurant();
  const tables = useTables(restaurant.id);
  const [today] = useState(() => yerevanToday());
  const day = useDayReservations(restaurant.id, today, 1);
  const blocks = useBlocks(restaurant.id);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);
  const add = useAddTable(restaurant.id);
  const save = useUpdateTable(restaurant.id);
  // Switching tables on and off from their lines, apart from the form, so each has its own state.
  const switching = useUpdateTable(restaurant.id);
  // Which form is open: a new table, or the id of the table being changed.
  const [open, setOpen] = useState<string | null>(null);
  const list = tables.data?.data;
  const editing = open === null || open === "new" ? undefined : list?.find((t) => t.id === open);
  const values = useMemo(() => (editing ? tableFields(editing) : NEW_TABLE), [editing]);
  const retrying = tables.isFetching && tables.errorUpdateCount > 0;

  function openForm(which: string): void {
    add.reset();
    save.reset();
    setOpen(which);
  }

  let body: ReactElement;
  if (list && list.length > 0) {
    body = (
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FloorPlan
          tables={list}
          statusFor={(table) => tableNow(table, day.data?.data ?? [], blocks.data?.data ?? [], now)}
        />
        <TableList
          tables={list}
          onEdit={(table) => openForm(table.id)}
          onSwitch={(table) =>
            switching.mutate({ tableId: table.id, change: { isActive: !table.isActive } })
          }
          switchingId={switching.isPending ? switching.variables.tableId : null}
          refusal={
            switching.error && switching.variables
              ? { tableId: switching.variables.tableId, error: switching.error }
              : null
          }
        />
      </div>
    );
  } else if (list) {
    body = <NoTablesYet onAdd={() => openForm("new")} />;
  } else if (tables.isError || retrying) {
    body = (
      <DashboardLoadFailed
        what="the tables"
        onRetry={() => void tables.refetch()}
        retrying={retrying}
      />
    );
  } else {
    body = <DashboardLoading label="Loading the tables" />;
  }

  return (
    <>
      <title>{`Tables · ${restaurant.name} · Seghan`}</title>
      <PartHeader
        title="Tables"
        description={
          list && list.length > 0
            ? `${tablesSummary(list)} · As they stand at ${yerevanClock(new Date(now))}`
            : undefined
        }
        action={
          list &&
          list.length > 0 && (
            <Button onClick={() => openForm("new")}>
              <PlusIcon />
              Add a table
            </Button>
          )
        }
        className="mb-6"
      />
      {body}

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={editing ? `Edit ${editing.label}` : "Add a table"}
      >
        {/* A new form each time it opens, so nothing typed last time is left behind. */}
        <TableForm
          key={open ?? "closed"}
          values={values}
          submitLabel={editing ? "Save table" : "Add the table"}
          pending={editing ? save.isPending : add.isPending}
          error={editing ? save.error : add.error}
          onCancel={() => setOpen(null)}
          onSubmit={(request) =>
            editing
              ? save.mutate(
                  { tableId: editing.id, change: request },
                  { onSuccess: () => setOpen(null) },
                )
              : add.mutate(request, { onSuccess: () => setOpen(null) })
          }
        />
      </Modal>
    </>
  );
}

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoTablesYet,
} from "@/features/dashboard/components/DashboardStates";
import { PartIntro } from "@/features/dashboard/components/PartIntro";
import { TableForm } from "@/features/dashboard/components/TableForm";
import { TableList } from "@/features/dashboard/components/TableList";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useAddTable, useTables, useUpdateTable } from "@/features/dashboard/hooks/useTables";
import { NEW_TABLE, tableFields, tablesSummary } from "@/features/dashboard/tables";

/** A restaurant's tables: add one, change one, switch one off or back on. */
export function DashboardTablesPage(): ReactElement {
  const restaurant = useDashboardRestaurant();
  const tables = useTables(restaurant.id);
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
      <h2 className="sr-only">Tables</h2>
      {list && list.length > 0 && (
        <PartIntro action={<Button onClick={() => openForm("new")}>Add a table</Button>}>
          {tablesSummary(list)}
        </PartIntro>
      )}
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

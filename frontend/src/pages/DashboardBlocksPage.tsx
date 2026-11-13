import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PartHeader } from "@/components/PartHeader";
import { newBlock } from "@/features/dashboard/blocks";
import { BlockForm } from "@/features/dashboard/components/BlockForm";
import { BlockCalendar } from "@/features/dashboard/components/BlockCalendar";
import { BlockList } from "@/features/dashboard/components/BlockList";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoBlocksYet,
} from "@/features/dashboard/components/DashboardStates";
import { useAddBlock, useBlocks, useRemoveBlock } from "@/features/dashboard/hooks/useBlocks";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useTables } from "@/features/dashboard/hooks/useTables";
import { yerevanToday } from "@/lib/time";

/**
 * A restaurant's blocked times: block a table or the whole restaurant, or remove a block. As in the
 * export, the list sits beside a month's calendar of the days they touch.
 */
export function DashboardBlocksPage(): ReactElement {
  const restaurant = useDashboardRestaurant();
  const blocks = useBlocks(restaurant.id);
  // The tables that can be blocked: the active ones.
  const tables = useTables(restaurant.id);
  const add = useAddBlock(restaurant.id);
  const remove = useRemoveBlock(restaurant.id);
  const [adding, setAdding] = useState(false);
  // Read once, when the page opens: a page has to render the same way each time.
  const [today] = useState(() => yerevanToday());
  const values = useMemo(() => newBlock(today), [today]);
  const activeTables = useMemo(
    () => (tables.data?.data ?? []).filter((table) => table.isActive),
    [tables.data],
  );
  const list = blocks.data?.data;
  const retrying = blocks.isFetching && blocks.errorUpdateCount > 0;

  function openForm(): void {
    add.reset();
    setAdding(true);
  }

  let body: ReactElement;
  if (list && list.length > 0) {
    body = (
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BlockList
          blocks={list}
          today={today}
          onRemove={(block) => remove.mutate(block.id)}
          removingId={remove.isPending ? remove.variables : null}
          error={remove.error}
        />
        <BlockCalendar blocks={list} today={today} />
      </div>
    );
  } else if (list) {
    body = <NoBlocksYet onAdd={openForm} />;
  } else if (blocks.isError || retrying) {
    body = (
      <DashboardLoadFailed
        what="the blocked times"
        onRetry={() => void blocks.refetch()}
        retrying={retrying}
      />
    );
  } else {
    body = <DashboardLoading label="Loading the blocked times" />;
  }

  return (
    <>
      <title>{`Blocked times · ${restaurant.name} · Seghan`}</title>
      <PartHeader
        title="Blocked times"
        description="Guests can’t book these times."
        action={list && list.length > 0 && <Button onClick={openForm}>Block a time</Button>}
        className="mb-6"
      />
      {body}

      <Modal open={adding} onClose={() => setAdding(false)} title="Block a time">
        {/* A new form each time it opens, so nothing typed last time is left behind. */}
        {adding && (
          <BlockForm
            tables={activeTables}
            values={values}
            pending={add.isPending}
            error={add.error}
            onCancel={() => setAdding(false)}
            onSubmit={(request) => add.mutate(request, { onSuccess: () => setAdding(false) })}
          />
        )}
      </Modal>
    </>
  );
}

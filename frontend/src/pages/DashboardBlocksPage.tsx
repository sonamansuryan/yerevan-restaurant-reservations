import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { newBlock } from "@/features/dashboard/blocks";
import { BlockForm } from "@/features/dashboard/components/BlockForm";
import { BlockList } from "@/features/dashboard/components/BlockList";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoBlocksYet,
} from "@/features/dashboard/components/DashboardStates";
import { PartIntro } from "@/features/dashboard/components/PartIntro";
import { useAddBlock, useBlocks, useRemoveBlock } from "@/features/dashboard/hooks/useBlocks";
import { useDashboardRestaurant } from "@/features/dashboard/hooks/useDashboardRestaurant";
import { useTables } from "@/features/dashboard/hooks/useTables";
import { yerevanToday } from "@/lib/time";

/** A restaurant's blocked times: block a table or the whole restaurant, or remove a block. */
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
      <BlockList
        blocks={list}
        today={today}
        onRemove={(block) => remove.mutate(block.id)}
        removingId={remove.isPending ? remove.variables : null}
        error={remove.error}
      />
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
      <h2 className="sr-only">Blocked times</h2>
      {list && list.length > 0 && (
        <PartIntro action={<Button onClick={openForm}>Block a time</Button>}>
          Guests can’t book these times.
        </PartIntro>
      )}
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

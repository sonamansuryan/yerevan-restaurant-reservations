import { useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { RefusalNotice } from "@/features/dashboard/components/RefusalNotice";
import { blockWhat, blockWhen } from "@/features/dashboard/blocks";
import type { ApiError } from "@/lib/api";
import type { OwnerBlock } from "@/types/api";

interface BlockListProps {
  blocks: OwnerBlock[];
  onRemove: (block: OwnerBlock) => void;
  /** The block whose removal is being sent. */
  removingId?: string | null;
  /** A removal that failed. */
  error?: ApiError | null;
  /** Today in Yerevan, so a day from another year shows its year. */
  today?: string;
}

/**
 * The blocked times that aren't over yet, by when they start: the days in serif, then the times
 * and what's blocked, and the owner's own reason. Removing one asks first, because guests can
 * book that time again straight away.
 */
export function BlockList({
  blocks,
  onRemove,
  removingId = null,
  error = null,
  today,
}: BlockListProps): ReactElement {
  const [confirming, setConfirming] = useState<OwnerBlock | null>(null);

  function remove(): void {
    if (confirming) onRemove(confirming);
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <RefusalNotice error={error} className="max-w-160" />
      <ul className="border-t border-line">
        {blocks.map((block) => {
          const { days, times } = blockWhen(block, today);
          const what = blockWhat(block);
          return (
            <li
              key={block.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line py-4"
            >
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-display text-title-xs break-words">{days}</p>
                <p className="mt-0.5 text-meta text-ink-secondary">
                  <span className="tabular-nums">{times}</span> · {what}
                </p>
                {block.reason && (
                  <p className="mt-1.5 text-meta break-words text-ink-secondary">
                    <span className="font-medium text-ink">Reason:</span> {block.reason}
                  </p>
                )}
              </div>
              <Button
                variant="link"
                aria-label={`Remove, ${days}, ${times}, ${what}`}
                loading={removingId === block.id}
                onClick={() => setConfirming(block)}
              >
                Remove
              </Button>
            </li>
          );
        })}
      </ul>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Remove this block?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
            <Button onClick={remove}>Remove block</Button>
          </>
        }
      >
        Guests can book this time again.
      </Modal>
    </div>
  );
}

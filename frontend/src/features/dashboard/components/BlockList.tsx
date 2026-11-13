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
 * The blocked times that aren't over yet, by when they start, as the export's "Blocked dates &
 * tables": one white panel, a line each, the days in bold, then the times and what's blocked, and
 * the owner's own reason, with Remove in wine. Removing one asks first, because guests can book that
 * time again straight away.
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
      <section className="min-w-0 overflow-hidden rounded-band border border-line bg-surface-raised">
        <h3 className="border-b border-line px-5 py-4 text-body font-semibold">
          Blocked dates &amp; tables
        </h3>
        <ul>
          {blocks.map((block) => {
            const { days, times } = blockWhen(block, today);
            const what = blockWhat(block);
            return (
              <li
                key={block.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft px-5 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-ui font-semibold break-words">{days}</p>
                  <p className="mt-0.5 text-meta text-ink-secondary">
                    <span className="tabular-nums">{times}</span> · {what}
                  </p>
                  {block.reason && (
                    <p className="mt-1.5 text-meta break-words text-ink-secondary">
                      <span className="font-semibold text-ink">Reason:</span> {block.reason}
                    </p>
                  )}
                </div>
                <Button
                  variant="danger"
                  size="compact"
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
      </section>

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

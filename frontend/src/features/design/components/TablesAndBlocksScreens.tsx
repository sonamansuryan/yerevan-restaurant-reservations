import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { PartHeader } from "@/components/PartHeader";
import { newBlock } from "@/features/dashboard/blocks";
import type { BlockFields } from "@/features/dashboard/blocks";
import { BlockCalendar } from "@/features/dashboard/components/BlockCalendar";
import { BlockForm } from "@/features/dashboard/components/BlockForm";
import { BlockList } from "@/features/dashboard/components/BlockList";
import {
  DashboardLoadFailed,
  DashboardLoading,
  NoBlocksYet,
  NoTablesYet,
} from "@/features/dashboard/components/DashboardStates";
import { FloorPlan } from "@/features/dashboard/components/FloorPlan";
import { TableForm } from "@/features/dashboard/components/TableForm";
import { TableList } from "@/features/dashboard/components/TableList";
import { NEW_TABLE, tableFields, tableNow, tablesSummary } from "@/features/dashboard/tables";
import { Group, Specimens } from "@/features/design/components/parts";
import { fridayBookings, ownedTables, sampleBlocks } from "@/features/design/samples";
import { screenStates } from "@/features/design/tokens";
import { ApiError } from "@/lib/api";
import type { OwnerReservation, OwnerTable } from "@/types/api";

type StateOf<K extends keyof typeof screenStates> = (typeof screenStates)[K][number];

const ignore = (): void => {};
// Friday 13 November, so a day in another year shows its year, whatever day it really is.
const FRIDAY = "2026-11-13";

function sampleTable(label: string): OwnerTable {
  const found = ownedTables.find((table) => table.label === label);
  if (!found) throw new Error(`No sample table ${label}`);
  return found;
}

function sampleBooking(id: string): OwnerReservation {
  const found = fridayBookings.find((booking) => booking.id === id);
  if (!found) throw new Error(`No sample booking ${id}`);
  return found;
}

const T1 = sampleTable("T1");
const T4 = sampleTable("T4");
const T6 = sampleTable("T6");
const activeTables = ownedTables.filter((table) => table.isActive);
const t4Fields = tableFields(T4);

// The server's answers, exactly as api.ts hands them over.
const tableHasBookings = new ApiError(
  409,
  "TABLE_HAS_BOOKINGS",
  "2 upcoming bookings still need this table. You can deactivate it once they're over or cancelled.",
  { reservations: [sampleBooking("booking-1"), sampleBooking("booking-6")] },
);
const lastActiveTable = new ApiError(
  409,
  "LAST_ACTIVE_TABLE",
  "A published restaurant needs at least one active table. Activate or add another table first, or unpublish the restaurant.",
);
const labelTaken = new ApiError(
  409,
  "TABLE_LABEL_TAKEN",
  "Another table already has this name. If it's deactivated, activate it again instead.",
);
const tooSmall = new ApiError(
  409,
  "TABLE_TOO_SMALL",
  "An upcoming booking for 5 guests needs this table. Keep at least 5 seats until it's over or cancelled.",
  {
    reservations: [
      {
        ...sampleBooking("booking-3"),
        partySize: 5,
        table: { id: T4.id, label: "T4", zone: "TERRACE" },
      },
    ],
  },
);
const blockHasBookings = new ApiError(
  409,
  "BLOCK_HAS_BOOKINGS",
  "2 upcoming bookings fall inside this block. Choose another time, or cancel them first.",
  { reservations: [sampleBooking("booking-3"), sampleBooking("booking-4")] },
);

// The floor plan's moment: Friday 13 November at 19:45 in Yerevan, which is 15:45 UTC.
const AT_19_45 = Date.parse("2026-11-13T15:45:00Z");

const tables: Record<StateOf<"tables">, ReactElement> = {
  "Every area (live)": (
    <div>
      <PartHeader
        title="Tables"
        headingLevel={4}
        description={`${tablesSummary(ownedTables)} · As they stand at 19:45`}
        action={<Button onClick={ignore}>Add a table</Button>}
        className="mb-6"
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <FloorPlan
          tables={ownedTables}
          statusFor={(table) => tableNow(table, fridayBookings, sampleBlocks, AT_19_45)}
          headingLevel={4}
        />
        <TableList tables={ownedTables} onEdit={ignore} onSwitch={ignore} headingLevel={4} />
      </div>
    </div>
  ),
  "No tables yet": <NoTablesYet onAdd={ignore} />,
  Loading: <DashboardLoading label="Loading the tables" />,
  "Couldn’t load": <DashboardLoadFailed what="the tables" onRetry={ignore} retrying={false} />,
  "Bookings need the table": (
    <TableList
      tables={ownedTables.slice(0, 3)}
      onEdit={ignore}
      onSwitch={ignore}
      refusal={{ tableId: T1.id, error: tableHasBookings }}
      headingLevel={4}
    />
  ),
  "The last active table": (
    <TableList
      tables={[T1, T6]}
      onEdit={ignore}
      onSwitch={ignore}
      refusal={{ tableId: T1.id, error: lastActiveTable }}
      headingLevel={4}
    />
  ),
};

const tableActions = { onSubmit: ignore, onCancel: ignore };

const tableForm: Record<StateOf<"tableForm">, ReactElement> = {
  "A new table (live)": (
    <TableForm values={NEW_TABLE} submitLabel="Add the table" {...tableActions} />
  ),
  "Editing T4": <TableForm values={t4Fields} submitLabel="Save table" {...tableActions} />,
  "Field errors": (
    <TableForm
      values={{ label: "", capacity: "2", minCapacity: "4", zone: "INDOOR" }}
      submitLabel="Add the table"
      validateOnMount
      {...tableActions}
    />
  ),
  Sending: <TableForm values={t4Fields} submitLabel="Save table" pending {...tableActions} />,
  "The name is taken": (
    <TableForm
      values={{ ...t4Fields, label: "T6" }}
      submitLabel="Save table"
      error={labelTaken}
      {...tableActions}
    />
  ),
  "Too few seats for a booking": (
    <TableForm
      values={{ ...t4Fields, capacity: "4" }}
      submitLabel="Save table"
      error={tooSmall}
      {...tableActions}
    />
  ),
};

const blockedTimes: Record<StateOf<"blockedTimes">, ReactElement> = {
  "Coming up (live)": (
    <div>
      <PartHeader
        title="Blocked times"
        headingLevel={4}
        description="Guests can’t book these times."
        action={<Button onClick={ignore}>Block a time</Button>}
        className="mb-6"
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BlockList blocks={sampleBlocks} today={FRIDAY} onRemove={ignore} />
        <BlockCalendar blocks={sampleBlocks} today={FRIDAY} headingLevel={4} />
      </div>
    </div>
  ),
  "No blocked times": <NoBlocksYet onAdd={ignore} />,
  Loading: <DashboardLoading label="Loading the blocked times" />,
  "Couldn’t load": (
    <DashboardLoadFailed what="the blocked times" onRetry={ignore} retrying={false} />
  ),
};

const blockActions = { tables: activeTables, onSubmit: ignore, onCancel: ignore };
const evening: BlockFields = {
  ...newBlock(FRIDAY),
  scope: "table",
  tableId: T4.id,
  kind: "range",
  fromDate: "2026-11-14",
  toDate: "2026-11-14",
  reason: "A wobbly leg",
};

const blockForm: Record<StateOf<"blockForm">, ReactElement> = {
  "A whole day (live)": <BlockForm values={newBlock(FRIDAY)} {...blockActions} />,
  "One table, a time range": <BlockForm values={evening} {...blockActions} />,
  "Field errors": (
    <BlockForm
      values={{
        ...evening,
        tableId: "",
        fromDate: "2026-11-21",
        fromTime: "02:00",
        toDate: "2026-11-20",
        toTime: "18:00",
        reason: "",
      }}
      validateOnMount
      {...blockActions}
    />
  ),
  Sending: <BlockForm values={newBlock(FRIDAY)} pending {...blockActions} />,
  "Bookings inside it": (
    <BlockForm values={newBlock(FRIDAY)} error={blockHasBookings} {...blockActions} />
  ),
};

/** The Tables and Blocked times parts of a restaurant's dashboard, in their states. */
export function TablesAndBlocksScreens(): ReactElement {
  return (
    <>
      <Group
        title="Tables"
        note="By area, each area in a white panel, each table a row with the parties it takes. An inactive table stays in its area, greyed, so it can be switched back on. Switching one off is refused while bookings need it, or when it's a published restaurant's last one: the refusal shows under its line."
      >
        <Specimens wide specimens={tables} />
      </Group>
      <Group
        title="Adding or changing a table"
        note="Opens over the page from Add a table or Edit, and rises from the bottom on a phone. A taken name shows under the name. Fewer seats than a booked party is refused, with the booking listed."
      >
        <Specimens specimens={tableForm} />
      </Group>
      <Group
        title="Blocked times"
        note="The blocks that aren't over yet, by when they start. A whole day says All day; a block that ends at midnight belongs to the day before. Remove asks first: the question opens over the page, so only the live one shows it."
      >
        <Specimens wide specimens={blockedTimes} />
      </Group>
      <Group
        title="Blocking a time"
        note="The whole restaurant or one table, for a whole day or a time range, in Yerevan time. Bookings inside the block are refused, with each one listed. The live one sends nothing."
      >
        <Specimens specimens={blockForm} />
      </Group>
    </>
  );
}

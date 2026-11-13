import type { ReactElement } from "react";

import { BarList } from "@/components/BarList";
import { Figures } from "@/components/Figures";
import { analyticsFigures, statusBars } from "@/features/analytics/analytics";
import { Group, Section, Specimen } from "@/features/design/components/parts";
import { firstWeekAnalytics, loriAnalytics, seghanAnalytics } from "@/features/design/samples";

const lori = loriAnalytics[30];

export function FiguresSection(): ReactElement {
  return (
    <Section
      id="figures"
      title="Figures"
      intro="Counts at a glance: headline numbers, and simple bars. Only the analytics use them so far."
    >
      <Group
        title="Figures"
        note="Each number under a hairline, like a column in a ledger, in the sans, whose figures read more plainly than the serif's. As many share a row as fit, two at least. A figure with nothing to count yet shows a dash, and screen readers hear a word instead."
      >
        <div className="grid gap-10">
          <Specimen label="Five across, as the analytics have them" frozen>
            <Figures figures={analyticsFigures(lori)} className="w-full" />
          </Specimen>
          <Specimen label="Nothing to count yet: no reviews" frozen>
            <Figures figures={analyticsFigures(firstWeekAnalytics).slice(3)} className="w-full" />
          </Specimen>
        </div>
      </Group>
      <Group
        title="BarList"
        note="Thin wine bars on one baseline, with the number in a column of figures. As parts of a whole, a full bar is the whole and the share sits beside each number; otherwise the largest is the full bar. A count too small to see still shows a sliver. The bar is only a picture of its number, so screen readers skip it. On a phone it drops under the name."
      >
        <div className="grid max-w-180 gap-10">
          <Specimen label="Parts of a whole: a month's bookings by status" frozen>
            <BarList bars={statusBars(lori)} max={lori.bookings} className="w-full" />
          </Specimen>
          <Specimen label="Against the largest: the most booked restaurants" frozen>
            <BarList
              bars={seghanAnalytics.restaurants.map(({ id, name, bookings }) => ({
                key: id,
                label: <span className="font-display text-title-xs">{name}</span>,
                value: bookings,
              }))}
              className="w-full"
            />
          </Specimen>
          <Specimen label="None, a sliver and thousands" frozen>
            <BarList
              bars={[
                { key: "none", label: "None at all", value: 0, note: "0%" },
                { key: "sliver", label: "One in many", value: 1, note: "<1%" },
                { key: "most", label: "Nearly all", value: 1283, note: ">99%" },
              ]}
              max={1284}
              className="w-full"
            />
          </Specimen>
        </div>
      </Group>
    </Section>
  );
}

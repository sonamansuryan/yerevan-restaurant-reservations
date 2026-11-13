import { useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Group, Section } from "@/features/design/components/parts";
import { animationToken, durationTokens, easingTokens } from "@/features/design/tokens";
import { tokenValue } from "@/features/design/tools";

interface TrackProps {
  role: string;
  name: string;
  duration: string;
  easing: string;
  moved: boolean;
}

function Track({ role, name, duration, easing, moved }: TrackProps): ReactElement {
  return (
    <div className="grid gap-x-6 gap-y-2 border-b border-line py-3 md:grid-cols-[14rem_minmax(0,1fr)] md:items-center">
      <div>
        <p className="text-ui font-medium">{role}</p>
        <p className="text-caption text-ink-muted">
          <code className="font-sans">--{name}</code> · {tokenValue(name)}
        </p>
      </div>
      <div className="relative h-3">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <span
          style={{
            left: moved ? "calc(100% - 0.75rem)" : "0",
            transition: `left ${duration} ${easing}`,
          }}
          className="absolute top-0 size-3 rounded-pill bg-accent motion-reduce:transition-none!"
        />
      </div>
    </div>
  );
}

export function MotionSection(): ReactElement {
  const [moved, setMoved] = useState(false);

  return (
    <Section
      id="motion"
      title="Motion"
      intro="Subtle and unhurried. Motion confirms what just happened, and stops for people who ask for less of it."
    >
      <div className="mt-6">
        <Button variant="ghost" onClick={() => setMoved((value) => !value)}>
          Play the timings
        </Button>
      </div>
      <Group title="Durations">
        {durationTokens.map((token) => (
          <Track
            key={token.name}
            {...token}
            duration={`var(--${token.name})`}
            easing="var(--ease-tile)"
            moved={moved}
          />
        ))}
      </Group>
      <Group title="Easing" note="Both run for the same time here, so only the feel differs.">
        {easingTokens.map((token) => (
          <Track
            key={token.name}
            {...token}
            duration="var(--transition-duration-tile)"
            easing={`var(--${token.name})`}
            moved={moved}
          />
        ))}
      </Group>
      <Group title="Breathing" note={`${animationToken.role}: a wine dot, gently breathing.`}>
        <div className="flex items-center gap-4">
          <Spinner />
          <code className="font-sans text-meta text-ink-muted">--{animationToken.name}</code>
        </div>
      </Group>
    </Section>
  );
}

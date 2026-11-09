import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { Select } from "@/components/Select";
import { Section } from "@/features/design/components/parts";

const widths = [
  { value: 360, label: "360 px, small phone" },
  { value: 390, label: "390 px, phone" },
  { value: 768, label: "768 px, tablet" },
  { value: 1024, label: "1024 px, laptop" },
  { value: 1280, label: "1280 px, desktop" },
];

const pages = [
  { value: "/design", label: "This page" },
  { value: "/", label: "Home" },
  { value: "/a-page-that-does-not-exist", label: "Not found" },
  { value: "/dev/error", label: "Error" },
];

const frameHeight = 760;

export function ResponsiveSection(): ReactElement {
  const [width, setWidth] = useState(390);
  const [page, setPage] = useState("/design");
  const [room, setRoom] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);

  // A frame wider than the column is drawn at its real width, then scaled down to fit.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => setRoom(area.clientWidth));
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // A frame showing this page would show another frame, and so on.
  if (window.self !== window.top) {
    return (
      <Section
        id="responsive"
        title="Responsive"
        intro="You're already inside the preview, so it stops here."
      />
    );
  }

  const scale = room > 0 ? Math.min(1, room / width) : 1;

  return (
    <Section
      id="responsive"
      title="Responsive"
      intro="A real page at a real width. Layouts respond to the real window, so this uses a frame. It's live, so scroll it and tap Menu."
    >
      <div className="mt-6 grid max-w-120 gap-6 sm:grid-cols-2">
        <Select
          label="Width"
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
        >
          {widths.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select label="Page" value={page} onChange={(event) => setPage(event.target.value)}>
          {pages.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div ref={areaRef} className="mt-6">
        <div
          style={{ width: width * scale, height: frameHeight * scale }}
          className="overflow-hidden rounded-media border border-line-strong"
        >
          <iframe
            key={page}
            src={page}
            title={`${page} at ${width}px`}
            style={{ width, height: frameHeight, transform: `scale(${scale})` }}
            className="origin-top-left"
          />
        </div>
        <p className="mt-2 text-meta text-ink-muted">
          {scale < 1
            ? `Shown at ${Math.round(scale * 100)}% to fit this column`
            : "Shown at full size"}
        </p>
      </div>
    </Section>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactElement, RefObject } from "react";

import { cx } from "@/lib/cx";

/*
 * The scene is drawn on a 400 × 520 canvas and seen through an arch, like the windows of Yerevan's
 * tuff-stone buildings. From back to front: the sky, Ararat, the haze over the plain, the city and
 * its lights, the rooftops nearby with a church, and the edge of your table.
 */
const HORIZON = 352;
// Where the plain disappears behind the rooftops nearby.
const NEAR = 470;

// Ararat as Yerevan sees it: Sis, the smaller cone, on the left, and Masis, broad and snow-capped,
// on the right. From the city, the sun sets west of it, behind Masis's long right-hand flank.
const SIS =
  "M-10 322 C 24 304, 66 262, 92 233 C 96 228, 101 228, 105 233 C 124 254, 150 276, 172 282";
const MASIS =
  "C 186 276, 204 252, 220 228 C 232 210, 244 184, 256 178 C 262 175, 270 175, 278 180 " +
  "C 296 192, 318 214, 338 232 C 350 243, 358 248, 368 252 C 384 262, 400 272, 420 280";
const MASSIF = `${SIS} ${MASIS} V${HORIZON + 6} H-10 Z`;

// The snow, with streaks down the gullies. They fan out from each summit, the way its slopes fall.
// Each is clipped to the mountain, so its upper edge is always the mountain's own.
const MASIS_SNOW =
  "M150 150 H430 V250 L372 250 L358 246 L353 250 L346 245 L340 247 L344 270 L333 247 L326 242 " +
  "L318 248 L311 241 L304 244 L306 287 L297 244 L290 240 L284 246 L277 239 L271 242 L268 262 " +
  "L264 242 L258 240 L253 244 L247 293 L242 244 L236 241 L230 247 L224 240 L220 244 L204 269 " +
  "L214 247 L207 248 L198 253 L150 253 Z";
const SIS_SNOW =
  "M60 200 H140 V252 L122 252 L114 249 L118 263 L109 250 L104 252 L99 273 L96 252 L90 250 " +
  "L84 254 L79 264 L80 255 L72 257 L60 257 Z";
// The faces turned away from the setting sun: left of each summit's ridge, rock and snow alike.
const SHADE =
  "M99 222 C 102 260, 108 310, 112 362 H-20 V222 Z " +
  "M172 282 C 168 300, 164 330, 162 362 H304 C 296 300, 286 236, 268 170 H172 Z";

// A church among the rooftops: a gabled front, a drum and a conical dome, which echoes Masis.
const CHURCH =
  "M238 520 V420 L248 415 V410 L266 400 L284 410 V415 L294 420 V520 Z M257 404 V384 H275 V404 Z " +
  "M255 385 L266 362 L277 385 Z";

const round = (value: number, digits = 1): number => Number(value.toFixed(digits));

/** The same pattern every time, so the city never rearranges itself between visits. */
function pattern(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** The far edge of the city, along the plain: a low, uneven line of rooftops. */
function farSkyline(): string {
  const next = pattern(3);
  let path = `M-10 520 V${HORIZON + 2}`;
  for (let x = -10; x < 410;) {
    const width = 5 + Math.floor(next() * 14);
    path += ` V${HORIZON + 3 - Math.floor(next() * 6)} H${x + width}`;
    x += width;
  }
  return `${path} V520 Z`;
}

interface Block {
  x: number;
  width: number;
  top: number;
}

/** The rooftops nearby, between the plain and your table. */
function nearBlocks(): Block[] {
  const next = pattern(5);
  const blocks: Block[] = [];
  for (let x = -10; x < 410;) {
    const width = 12 + Math.floor(next() * 30);
    blocks.push({ x, width, top: NEAR - 32 + Math.floor(next() * 22) });
    x += width;
  }
  return blocks;
}

interface Light {
  id: number;
  x: number;
  y: number;
  /** A lamp's radius, or a window's width. */
  size: number;
  delay: number;
  glow: number;
  /** A few glow rose instead of cream: restaurants, in the brand's own color. */
  rose: boolean;
  /** The brightest, nearer ones carry a soft halo. */
  halo: boolean;
}

// Streets run away from you towards the mountain, from where each crosses the bottom edge.
const STREETS = [-260, -110, 40, 186, 320, 470];

/**
 * The city's lights: lamps along the streets, which come on one after another, away from you, and
 * windows scattered across the plain, more of them and smaller towards the horizon.
 */
function cityLights(): Light[] {
  const next = pattern(11);
  const lights: Light[] = [];
  for (const start of STREETS) {
    for (let step = 0; step < 26; step++) {
      // 1 at the near edge of the plain, falling towards 0 at the horizon: perspective.
      const depth = 1 / (1 + 0.28 * step);
      const x = 232 + (start - 232) * depth;
      if (x < -2 || x > 402) continue;
      lights.push({
        id: lights.length,
        x: round(x),
        y: round(HORIZON + (NEAR - HORIZON) * depth),
        size: round(0.45 + depth * 0.85, 2),
        delay: round(1.9 + step * 0.07, 2),
        glow: round(0.55 + depth * 0.4, 2),
        rose: false,
        halo: depth > 0.45 && step % 2 === 0,
      });
    }
  }
  for (let i = 0; i < 170; i++) {
    const depth = next() ** 2.2;
    lights.push({
      id: lights.length,
      x: round(next() * 400),
      y: round(HORIZON + 3 + depth * (NEAR - HORIZON - 8)),
      size: round(0.4 + depth * 1.2, 2),
      delay: round(2.2 + next() * 3.6, 2),
      glow: round(0.35 + next() * 0.55, 2),
      rose: next() < 0.09,
      halo: depth > 0.3 && next() < 0.35,
    });
  }
  return lights;
}

/** A few small lit windows in the rooftops nearby. */
function nearWindows(blocks: readonly Block[]): Light[] {
  const next = pattern(29);
  const lights: Light[] = [];
  for (const block of blocks) {
    for (let y = block.top + 5; y + 3 < 482; y += 8) {
      for (let x = block.x + 4; x + 6 < block.x + block.width; x += 7) {
        if (next() < 0.78) continue;
        lights.push({
          id: lights.length,
          x,
          y,
          size: 2.2,
          delay: round(2.6 + next() * 3, 2),
          glow: round(0.55 + next() * 0.4, 2),
          rose: next() < 0.15,
          halo: false,
        });
      }
    }
  }
  return lights;
}

const CITY = farSkyline();
const LIGHTS = cityLights();
const BLOCKS = nearBlocks();
const WINDOWS = nearWindows(BLOCKS);

// Stars come out last, inside the arch. The evening star, Venus, comes first, low in the west.
const STARS = [
  [96, 132, 0.8],
  [142, 74, 0.6],
  [178, 118, 0.9],
  [214, 52, 0.7],
  [226, 128, 0.6],
  [298, 96, 1],
  [122, 176, 0.6],
  [58, 196, 0.7],
  [178, 168, 0.5],
  [338, 140, 0.7],
  [160, 32, 0.5],
  [250, 30, 0.6],
  [36, 250, 0.5],
] as const;

/**
 * True once the scene is mostly in view, so its evening begins when someone is looking. On
 * narrower screens it sits below the search. Without IntersectionObserver, it simply begins.
 */
function useStartsWhenSeen(ref: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, seen]);

  return seen;
}

/** A gradient stop in a token color, or a mix of two (defined on `.evening` in index.css). */
const stop = (offset: number, color: string, opacity = 1): ReactElement => (
  <stop offset={offset} style={{ stopColor: `var(--${color})`, stopOpacity: opacity }} />
);

const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });
const lightColor = (light: Light): string =>
  light.rose ? "var(--evening-rose)" : "var(--evening-lamplight)";

/**
 * Evening over Yerevan: Ararat at dusk above the city, seen from your table. As it comes into view,
 * the evening begins. The sun sets behind the mountain, its snow glows and then cools, the sky
 * turns to blue hour, and the city's lights come on, street by street. Then the candle on your
 * table is lit. It shows the line beside it: "Find yours at restaurants across the city."
 *
 * Its colors are Seghan's tokens, or mixes of two, and the motion is in index.css (`.evening-…`).
 * People who ask their device for less motion see the finished evening, still. Screen readers hear
 * only the caption.
 */
export function EveningOverYerevan({ className }: { className?: string }): ReactElement {
  const figure = useRef<HTMLElement>(null);
  const playing = useStartsWhenSeen(figure);
  // Gradients and clips need ids, unique even when the scene appears twice, as in /design.
  const id = `evening${useId().replace(/[^\w-]/g, "")}`;
  const url = (name: string): string => `url(#${id}-${name})`;

  return (
    // Named by its caption, explicitly: not every browser takes a figure's name from its figcaption.
    <figure
      ref={figure}
      aria-labelledby={`${id}-caption`}
      data-playing={playing || undefined}
      className={cx("evening", className)}
    >
      {/* The window's frame, one hairline like the rules around the site, and the arch inside it. */}
      <div className="rounded-t-pill border border-line-rule p-2">
        <div className="overflow-hidden rounded-t-pill">
          {/* The whole picture moves as one layer, so the browser can hand the slow pull back to
              the GPU instead of redrawing every light at every step. */}
          <svg
            viewBox="0 0 400 520"
            aria-hidden="true"
            focusable="false"
            className="evening-camera block h-auto w-full"
          >
            <defs>
              <clipPath id={`${id}-massif`}>
                <path d={MASSIF} />
              </clipPath>

              {/* Dusk: deep teal above, then plum and wine, and a rose glow along the horizon. */}
              <linearGradient
                id={`${id}-dusk`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2={HORIZON + 10}
              >
                {stop(0, "color-tone-4")}
                {stop(0.38, "color-tone-2")}
                {stop(0.66, "color-accent")}
                {stop(0.86, "evening-rose")}
                {stop(1, "evening-blush")}
              </linearGradient>
              {/* Blue hour, where the evening settles: night above, the last of the wine below. */}
              <linearGradient
                id={`${id}-night`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2={HORIZON + 10}
              >
                {stop(0, "evening-midnight")}
                {stop(0.42, "color-tone-4")}
                {stop(0.76, "color-tone-2")}
                {stop(1, "evening-afterglow")}
              </linearGradient>
              <radialGradient id={`${id}-halo`}>
                {stop(0, "evening-lamplight", 0.4)}
                {stop(1, "evening-lamplight", 0)}
              </radialGradient>
              <radialGradient id={`${id}-afterglow`}>
                {stop(0, "evening-rose", 0.34)}
                {stop(1, "evening-rose", 0)}
              </radialGradient>
              <radialGradient id={`${id}-sunlight`}>
                {stop(0, "color-surface-page", 0.9)}
                {stop(0.12, "evening-blush", 0.75)}
                {stop(0.45, "evening-rose", 0.3)}
                {stop(1, "evening-rose", 0)}
              </radialGradient>
              <linearGradient id={`${id}-haze`} x1="0" y1="0" x2="0" y2="1">
                {stop(0, "evening-rose", 0)}
                {stop(0.6, "evening-blush", 0.42)}
                {stop(1, "evening-rose", 0)}
              </linearGradient>
              {/* The plain: hazy where it meets the mountain, darker as it comes nearer. */}
              <linearGradient id={`${id}-plain`} x1="0" y1="0" x2="0" y2="1">
                {stop(0, "evening-plain")}
                {stop(0.7, "color-surface-dark")}
              </linearGradient>
              <linearGradient id={`${id}-daylight`} x1="0" y1="0" x2="0" y2="1">
                {stop(0, "evening-rose", 0.3)}
                {stop(0.6, "evening-rose", 0.05)}
              </linearGradient>
              <linearGradient id={`${id}-cityglow`} x1="0" y1="0" x2="0" y2="1">
                {stop(0, "evening-rose", 0)}
                {stop(0.16, "evening-rose", 0.32)}
                {stop(0.62, "evening-rose", 0.1)}
                {stop(1, "evening-rose", 0)}
              </linearGradient>
              <radialGradient id={`${id}-candlelight`}>
                {stop(0, "evening-lamplight", 0.6)}
                {stop(0.25, "evening-rose", 0.2)}
                {stop(1, "evening-rose", 0)}
              </radialGradient>
              <radialGradient id={`${id}-pool`}>
                {stop(0, "evening-lamplight", 0.5)}
                {stop(1, "evening-lamplight", 0)}
              </radialGradient>
              <radialGradient id={`${id}-flame`} cy="0.7" r="0.62">
                {stop(0, "color-surface-page")}
                {stop(0.5, "evening-lamplight")}
                {stop(1, "evening-rose")}
              </radialGradient>
              {/* The table top catches the last of the sky at its far edge. */}
              <linearGradient id={`${id}-table`} x1="0" y1="0" x2="0" y2="1">
                {stop(0, "evening-tabletop")}
                {stop(0.5, "color-surface-dark")}
              </linearGradient>
            </defs>

            {/* The sky, from dusk into blue hour, and the stars. */}
            <rect width="400" height="520" fill={url("dusk")} />
            <rect className="evening-night" width="400" height="520" fill={url("night")} />
            {/* The western sky holds a little light after the sun has gone. */}
            <circle cx="390" cy="300" r="190" fill={url("afterglow")} />
            {STARS.map(([x, y, r], index) => (
              <circle
                key={`${x},${y}`}
                cx={x}
                cy={y}
                r={r}
                className="evening-star fill-on-dark"
                style={delay(round(5 + index * 0.16, 2))}
              />
            ))}
            <circle
              cx="330"
              cy="150"
              r="1.5"
              className="evening-star fill-on-dark"
              style={delay(3.4)}
            />

            {/* The sun, setting behind Masis. */}
            <g className="evening-sun">
              <circle cx="352" cy="206" r="140" fill={url("sunlight")} />
              <circle cx="352" cy="206" r="12" className="fill-surface-page" />
            </g>

            {/* Ararat. Its snow glows as the sun goes, then cools. */}
            <path d={MASSIF} style={{ fill: "var(--evening-mountain)" }} />
            <g clipPath={url("massif")}>
              <g className="fill-surface-tinted">
                <path d={MASIS_SNOW} />
                <path d={SIS_SNOW} />
              </g>
              <g className="evening-alpenglow" style={{ fill: "var(--evening-rose)" }}>
                <path d={MASIS_SNOW} />
                <path d={SIS_SNOW} />
              </g>
              <g className="evening-snow-cools fill-tone-4">
                <path d={MASIS_SNOW} />
                <path d={SIS_SNOW} />
              </g>
              <path d={SHADE} className="fill-surface-dark" fillOpacity="0.2" />
            </g>

            {/* Warm air over the plain, fading with the light. */}
            <rect className="evening-haze" y="300" width="400" height="76" fill={url("haze")} />

            {/* The city across the plain, and its lights coming on. */}
            <path d={CITY} fill={url("plain")} />
            {/* At dusk the plain still holds some daylight. It drains away as the night falls. */}
            <path d={CITY} className="evening-daylight" fill={url("daylight")} />
            {LIGHTS.filter((light) => light.halo).map((light) => (
              <circle
                key={`halo-${light.id}`}
                cx={light.x}
                cy={light.y}
                r={light.size * 4.5}
                className="evening-light"
                fill={url("halo")}
                style={delay(light.delay)}
              />
            ))}
            {LIGHTS.map((light) => (
              <circle
                key={light.id}
                cx={light.x}
                cy={light.y}
                r={light.size}
                className="evening-light"
                style={{ ...delay(light.delay), opacity: light.glow, fill: lightColor(light) }}
              />
            ))}

            {/* The glow a lit city throws into the air above it. */}
            <rect
              className="evening-cityglow"
              y={HORIZON - 16}
              width="400"
              height="134"
              fill={url("cityglow")}
            />

            {/* The rooftops nearby, the church among them, and a few lit windows. */}
            <g className="fill-surface-dark">
              {BLOCKS.map((block) => (
                <rect
                  key={block.x}
                  x={block.x}
                  y={block.top}
                  width={block.width}
                  height={520 - block.top}
                />
              ))}
              <path d={CHURCH} />
            </g>
            {WINDOWS.map((light) => (
              <rect
                key={light.id}
                x={light.x}
                y={light.y}
                width={light.size}
                height={light.size * 1.3}
                className="evening-light"
                style={{ ...delay(light.delay), opacity: light.glow, fill: lightColor(light) }}
              />
            ))}

            {/* Your table, and the candle on it, lit last. */}
            <rect y="482" width="400" height="38" fill={url("table")} />
            <path
              d="M0 482.5 H400"
              style={{ stroke: "var(--evening-blush)" }}
              strokeOpacity="0.22"
              strokeWidth="0.6"
            />
            <ellipse
              className="evening-candlelight"
              cx="94"
              cy="490"
              rx="46"
              ry="5.5"
              fill={url("pool")}
            />
            <circle
              className="evening-candlelight"
              cx="94"
              cy="463"
              r="60"
              fill={url("candlelight")}
            />
            {/* Drawn at 94, 482, where the candle stands, and shown a quarter larger. */}
            <g transform="translate(94 482) scale(1.25) translate(-94 -482)">
              <rect
                x="84"
                y="458"
                width="20"
                height="24"
                rx="1.5"
                className="fill-on-dark stroke-on-dark-secondary"
                fillOpacity="0.06"
                strokeOpacity="0.35"
                strokeWidth="0.6"
              />
              <rect
                x="87.5"
                y="470"
                width="13"
                height="11.5"
                rx="0.8"
                className="fill-surface-tinted"
                fillOpacity="0.45"
              />
              <rect
                className="evening-candlelight"
                x="84"
                y="458"
                width="20"
                height="24"
                rx="1.5"
                style={{ fill: "var(--evening-lamplight)" }}
                fillOpacity="0.45"
              />
              <path d="M94 470 V466.5" className="stroke-surface-dark" strokeWidth="0.7" />
              <path
                className="evening-flame"
                d="M94 455.5 C 97.6 461, 98 464.5, 94 468 C 90 464.5, 90.4 461, 94 455.5 Z"
                fill={url("flame")}
              />
            </g>
          </svg>
        </div>
      </div>
      <figcaption
        id={`${id}-caption`}
        className="mt-4 text-center font-display text-title-xs text-ink-muted italic"
      >
        Ararat at dusk, from Yerevan
      </figcaption>
    </figure>
  );
}

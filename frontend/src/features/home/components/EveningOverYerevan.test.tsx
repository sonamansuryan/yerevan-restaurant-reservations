// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { EveningOverYerevan } from "@/features/home/components/EveningOverYerevan";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Vitest empties imported CSS, so the stylesheet is read from disk, and so is the scene's source.
const css = readFileSync(resolve(import.meta.dirname, "../../../index.css"), "utf8");
const source = readFileSync(resolve(import.meta.dirname, "EveningOverYerevan.tsx"), "utf8");

function renderScene(): { figure: HTMLElement; svg: SVGSVGElement } {
  render(<EveningOverYerevan />);
  const figure = screen.getByRole("figure", { name: "Ararat at dusk, from Yerevan" });
  const svg = figure.querySelector("svg");
  if (!svg) throw new Error("No scene");
  return { figure, svg };
}

/** A stand-in IntersectionObserver that the test tells when the scene comes into view. */
function fakeObserver(): { show: (seen: boolean) => void; disconnect: () => void } {
  let report: (entries: { isIntersecting: boolean }[]) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof report) {
        report = callback;
      }
      observe(): void {}
      disconnect = disconnect;
    },
  );
  return { show: (seen) => act(() => report([{ isIntersecting: seen }])), disconnect };
}

const delayOf = (element: Element): number =>
  Number.parseFloat((element as SVGElement).style.animationDelay);

test("screen readers hear only the caption: the picture itself is decoration", () => {
  const { svg } = renderScene();

  expect(svg.getAttribute("aria-hidden")).toBe("true");
  expect(svg.getAttribute("focusable")).toBe("false");
  expect(svg.querySelector("title, text")).toBeNull();
});

test("its evening waits, at dusk, until the scene is in view", () => {
  const observer = fakeObserver();
  const { figure } = renderScene();
  expect(figure.dataset.playing).toBeUndefined();

  observer.show(false);
  expect(figure.dataset.playing).toBeUndefined();

  observer.show(true);
  expect(figure.dataset.playing).toBe("true");
  expect(observer.disconnect).toHaveBeenCalled();
  // Until then, every part of it holds still.
  expect(css).toMatch(/\.evening:not\(\[data-playing\]\) \* \{\s*animation-play-state: paused;/);
});

test("without IntersectionObserver, the evening simply begins", () => {
  vi.stubGlobal("IntersectionObserver", undefined);

  expect(renderScene().figure.dataset.playing).toBe("true");
});

test("the city is the same at every visit, and a few of its lights are restaurants in rose", () => {
  const lights = (): string[] =>
    [...renderScene().svg.querySelectorAll(".evening-light")].map(
      (light) =>
        `${light.getAttribute("cx") ?? light.getAttribute("x")},${light.getAttribute("cy") ?? light.getAttribute("y")}`,
    );
  const first = lights();
  cleanup();

  expect(lights()).toEqual(first);
  expect(first.length).toBeGreaterThan(200);
  const rose = screen
    .getByRole("figure")
    .querySelectorAll('.evening-light[style*="--evening-rose"]');
  expect(rose.length).toBeGreaterThan(0);
  expect(rose.length).toBeLessThan(first.length * 0.15);
});

test("the candle on your table is lit last, after every light in the city", () => {
  const { svg } = renderScene();
  const lastLight = Math.max(...[...svg.querySelectorAll(".evening-light")].map(delayOf));
  const candle = /\.evening-flame \{[^}]*evening-candle [\d.]+s [\w-]+ ([\d.]+)s/.exec(css)?.[1];

  expect(Number(candle)).toBeGreaterThan(lastLight);
});

test("only the candle keeps moving: everything else plays once", () => {
  const loops = [...css.matchAll(/(evening-[\w-]+) [\d.]+s [^;,]*infinite/g)].map(
    ([, name]) => name,
  );

  expect(loops.sort()).toEqual(["evening-flicker", "evening-glow"]);
});

test("people who ask for less motion see the finished evening, still", () => {
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.evening \* \{\s*animation: none;/,
  );
});

test("every color is one of Seghan's tokens, or a mix of two of them", () => {
  expect(source).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i);
  const block = /\.evening \{([^}]*)\}/.exec(css)?.[1] ?? "";
  const mixes = [...block.matchAll(/--(evening-[\w-]+): (.+);/g)];
  expect(mixes.length).toBeGreaterThan(0);
  for (const [, , value] of mixes) {
    expect(value).toMatch(
      /^color-mix\(in oklab, var\(--color-[\w-]+\)( \d+%)?, var\(--color-[\w-]+\)\)$/,
    );
    for (const [, token] of value?.matchAll(/var\((--color-[\w-]+)\)/g) ?? []) {
      expect(css).toContain(`${token}:`);
    }
  }
});

test("two scenes on one page, as in /design, each use their own gradients", () => {
  render(
    <>
      <EveningOverYerevan />
      <EveningOverYerevan />
    </>,
  );
  const [one, two] = screen.getAllByRole("figure");
  const ids = (figure: HTMLElement | undefined): string[] =>
    [...(figure?.querySelectorAll("[id]") ?? [])].map((element) => element.id);

  expect(ids(one).filter((id) => ids(two).includes(id))).toEqual([]);
  // Every gradient or clip a scene refers to is its own.
  for (const figure of [one, two]) {
    const references = [...(figure?.innerHTML.matchAll(/url\(#([^)]+)\)/g) ?? [])];
    expect(references.length).toBeGreaterThan(10);
    for (const [, id] of references) expect(ids(figure)).toContain(id);
  }
});

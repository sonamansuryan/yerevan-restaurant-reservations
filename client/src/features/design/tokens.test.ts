/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  animationToken,
  colorGroups,
  contents,
  displaySizes,
  durationTokens,
  easingTokens,
  fontTokens,
  pageWidthToken,
  radiusTokens,
  ruleShadowTokens,
  shadowTokens,
  shownComponents,
  spaceTokens,
  typeDetails,
  uiSizes,
} from "@/features/design/tokens";

const reason = "/design shows every token and component: update features/design/tokens.ts";

// Read from disk, because Vitest replaces imported CSS with an empty string.
const css = readFileSync(resolve(import.meta.dirname, "../../index.css"), "utf8");
const theme = /@theme static \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
const declared = [...theme.matchAll(/^\s+--([a-z0-9-]+):/gm)].map(([, name = ""]) => name);

// `--text-title--line-height` belongs to `--text-title`, so only the size itself is listed.
const tokens = declared.filter((name) => !name.includes("--"));
const companions = declared.filter((name) => name.includes("--"));

const listed = [
  ...colorGroups.flatMap((group) => group.tokens).map((token) => `color-${token.name}`),
  ...[...displaySizes, ...uiSizes].map((size) => `text-${size.name}`),
  ...[
    ...fontTokens,
    ...typeDetails,
    ...spaceTokens,
    pageWidthToken,
    ...radiusTokens,
    ...shadowTokens,
    ...ruleShadowTokens,
    ...durationTokens,
    ...easingTokens,
    animationToken,
  ].map((token) => token.name),
];

describe("tokens", () => {
  test("the check really reads the tokens from index.css", () => {
    expect(tokens).toContain("color-accent");
    expect(tokens).toContain("text-hero");
    expect(companions).toContain("text-hero--line-height");
  });

  test("every token in index.css is listed, and every listed token exists", () => {
    expect([...listed].sort(), reason).toEqual([...tokens].sort());
  });

  test("no token is listed twice", () => {
    expect(new Set(listed).size).toBe(listed.length);
  });

  test("every line height and letter spacing belongs to a listed size", () => {
    const orphans = companions.filter((name) => !listed.includes(name.split("--")[0] ?? ""));

    expect(orphans, reason).toEqual([]);
  });
});

describe("components", () => {
  const folder = resolve(import.meta.dirname, "../../components");
  const files = readdirSync(folder)
    .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
    .map((file) => file.replace(".tsx", ""));

  test("the check really reads the components folder", () => {
    expect(files).toContain("Button");
    expect(files).toContain("ErrorState");
  });

  test("every shared component is listed, and every listed file exists", () => {
    const shown = new Set(shownComponents.map((component) => component.file));

    expect([...shown].sort(), reason).toEqual([...files].sort());
  });

  test("no component is listed twice", () => {
    const names = shownComponents.map((component) => component.name);

    expect(new Set(names).size).toBe(names.length);
  });
});

describe("contents", () => {
  const ids = contents.map((entry) => entry.id);

  test("no section is listed twice", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every component belongs to a real section", () => {
    const unknown = shownComponents.filter((component) => !ids.includes(component.section));

    expect(unknown).toEqual([]);
  });

  test("the token counts add up to every token", () => {
    const tokenSections = contents.slice(0, 5).map((entry) => entry.items);
    const total = tokenSections.reduce<number>((sum, items) => sum + Number(items), 0);

    expect(total).toBe(tokens.length);
  });

  test("the component counts add up to every component", () => {
    const componentSections = contents.slice(5, 10).map((entry) => entry.items);
    const total = componentSections.reduce<number>((sum, items) => sum + Number(items), 0);

    expect(total).toBe(shownComponents.length);
  });
});

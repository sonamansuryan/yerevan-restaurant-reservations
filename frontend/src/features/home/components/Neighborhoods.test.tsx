// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";

import { Neighborhoods } from "@/features/home/components/Neighborhoods";
import type { Area } from "@/features/home/components/Neighborhoods";

afterEach(cleanup);

function renderAreas(areas: Area[]): void {
  render(
    <MemoryRouter>
      <Neighborhoods areas={areas} />
    </MemoryRouter>,
  );
}

const kentron = { to: "/restaurants?district=KENTRON", label: "Kentron" };
const arabkir = { to: "/restaurants?district=ARABKIR", label: "Arabkir" };
const norNork = { to: "/restaurants?district=NOR_NORK", label: "Nor Nork" };
const malatia = { to: "/restaurants?district=MALATIA_SEBASTIA", label: "Malatia-Sebastia" };

test("each district opens Browse filtered to it, with how many restaurants it has", () => {
  renderAreas([
    { ...kentron, count: 13 },
    { ...arabkir, count: 1 },
  ]);

  expect(screen.getByRole("link", { name: "Kentron 13 restaurants" }).getAttribute("href")).toBe(
    "/restaurants?district=KENTRON",
  );
  expect(screen.getByRole("link", { name: "Arabkir 1 restaurant" })).toBeDefined();
});

test("until it's counted, a district shows its name alone, keeping the count's line", () => {
  renderAreas([kentron]);

  const link = screen.getByRole("link", { name: /^Kentron\s*$/ });
  const count = link.querySelectorAll("span")[1];
  expect(count?.textContent).toBe(" ");
});

test("the four tiles each have their own tone", () => {
  renderAreas([kentron, arabkir, norNork, malatia]);

  const tones = screen
    .getAllByRole("link")
    .map((link) => /\bbg-tone-[1-6]\b/.exec(link.className)?.[0]);
  expect(new Set(tones).size).toBe(4);
  expect(tones).not.toContain(undefined);
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { OfficeLayout } from "@/components/OfficeLayout";

afterEach(cleanup);

function renderOffice(): HTMLElement {
  const { container } = render(
    <OfficeLayout nav={<nav aria-label="Lori Smokehouse">The menu</nav>}>
      <h2>Reservations</h2>
    </OfficeLayout>,
  );
  return container.firstElementChild as HTMLElement;
}

test("the menu comes first, then the open part", () => {
  renderOffice();

  const nav = screen.getByRole("navigation", { name: "Lori Smokehouse" });
  const part = screen.getByRole("heading", { name: "Reservations" });
  expect(nav.compareDocumentPosition(part)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

test("it's a grid at least as tall as the window, with the menu beside the part on wide screens", () => {
  const frame = renderOffice();

  // jsdom applies no CSS, so this reads the classes that make the frame.
  expect(frame.className.split(" ")).toEqual(expect.arrayContaining(["min-h-dvh", "lg:grid"]));
  expect(frame.children).toHaveLength(2);
  expect(frame.firstElementChild).toBe(screen.getByRole("navigation"));
});

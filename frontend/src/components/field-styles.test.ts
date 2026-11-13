import { expect, test } from "vitest";

import { controlClass } from "@/components/field-styles";

const states = [
  { name: "normal", invalid: false, disabled: false },
  { name: "invalid", invalid: true, disabled: false },
  { name: "disabled", invalid: false, disabled: true },
  { name: "disabled and invalid", invalid: true, disabled: true },
];

const isBorderColor = (name: string): boolean =>
  name.startsWith("border-") && name !== "border-dashed";

// Two classes for one property don't override each other, because Tailwind decides which one wins.
test.each(states)("the $name state sets one line, one fill and one text color", (state) => {
  const classes = controlClass(state).split(" ");

  expect(classes.filter(isBorderColor)).toHaveLength(1);
  expect(classes.filter((name) => name.startsWith("bg-"))).toHaveLength(1);
  expect(classes.filter((name) => /^text-(ink|error)/.test(name))).toHaveLength(1);
});

test("a field is a white box with rounded corners", () => {
  const classes = controlClass({ invalid: false, disabled: false }).split(" ");

  expect(classes).toContain("border");
  expect(classes).toContain("rounded-card");
  expect(classes).toContain("bg-surface-raised");
});

test("focus turns the line to the accent and doubles it with a ring, which takes no room", () => {
  const classes = controlClass({ invalid: false, disabled: false }).split(" ");

  expect(classes).toContain("focus:border-accent");
  expect(classes).toContain("focus:ring-1");
  expect(classes).toContain("focus:ring-accent");
});

test("the ring is switched off in a way forced high-contrast mode still shows", () => {
  expect(controlClass({ invalid: false, disabled: false })).toContain("outline-hidden");
  expect(controlClass({ invalid: false, disabled: false })).not.toContain("outline-none");
});

test("its right padding is left to each field, so an arrow or Show has room", () => {
  const classes = controlClass({ invalid: false, disabled: false }).split(" ");

  expect(classes.some((name) => /^(px|pr)-/.test(name))).toBe(false);
});

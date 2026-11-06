import { expect, test } from "vitest";

import { controlClass } from "@/components/field-styles";

const states = [
  { name: "normal", invalid: false, disabled: false },
  { name: "invalid", invalid: true, disabled: false },
  { name: "disabled", invalid: false, disabled: true },
  { name: "disabled and invalid", invalid: true, disabled: true },
];

const isBorderColor = (name: string): boolean =>
  name.startsWith("border-") && name !== "border-b" && name !== "border-dashed";

// Two classes for one property don't override each other, because Tailwind decides which one wins.
test.each(states)("the $name state sets one line color and one text color", (state) => {
  const classes = controlClass(state).split(" ");

  expect(classes.filter(isBorderColor)).toHaveLength(1);
  expect(classes.filter((name) => /^text-(ink|error)/.test(name))).toHaveLength(1);
});

test("a field is a ruled line, not a box", () => {
  const classes = controlClass({ invalid: false, disabled: false }).split(" ");

  expect(classes).toContain("border-b");
  expect(classes).toContain("bg-transparent");
});

test("focus turns the line to the accent and doubles it", () => {
  const classes = controlClass({ invalid: false, disabled: false }).split(" ");

  expect(classes).toContain("focus:border-accent");
  expect(classes).toContain("focus:shadow-rule-focus");
});

test("the ring is switched off in a way forced high-contrast mode still shows", () => {
  expect(controlClass({ invalid: false, disabled: false })).toContain("outline-hidden");
  expect(controlClass({ invalid: false, disabled: false })).not.toContain("outline-none");
});

test("the error state uses the error color, focused or not", () => {
  const classes = controlClass({ invalid: true, disabled: false }).split(" ");

  expect(classes).toContain("border-error");
  expect(classes).toContain("focus:shadow-rule-error");
});

test("a disabled line is dashed", () => {
  expect(controlClass({ invalid: false, disabled: true })).toContain("border-dashed");
});

test("disabled wins over invalid, because a disabled field can't be fixed", () => {
  expect(controlClass({ invalid: true, disabled: true })).not.toContain("border-error");
});

test("field text is 16px, or iPhones zoom the page when a field gets focus", () => {
  expect(controlClass({ invalid: false, disabled: false }).split(" ")).toContain("text-body");
});

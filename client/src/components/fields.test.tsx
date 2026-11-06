// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Checkbox } from "@/components/Checkbox";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";

afterEach(cleanup);

interface SharedProps {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
}

// Input, Select and Textarea share the same label, hint and error wiring, so they share these tests.
const controls: [string, "textbox" | "combobox", (props: SharedProps) => ReactElement][] = [
  ["Input", "textbox", (props) => <Input {...props} />],
  ["Textarea", "textbox", (props) => <Textarea {...props} />],
  [
    "Select",
    "combobox",
    (props) => (
      <Select {...props}>
        <option>Tonight</option>
      </Select>
    ),
  ],
];

describe.each(controls)("%s", (_name, role, renderControl) => {
  test("its visible label names it", () => {
    render(renderControl({ label: "Date" }));

    expect(screen.getByRole(role, { name: "Date" })).toBeDefined();
    expect(screen.getByText("Date").tagName).toBe("LABEL");
  });

  test("a valid control isn't marked invalid", () => {
    render(renderControl({ label: "Date" }));
    const control = screen.getByRole(role, { name: "Date" });

    expect(control.getAttribute("aria-invalid")).toBeNull();
    expect(control.getAttribute("aria-describedby")).toBeNull();
  });

  test("the hint describes it", () => {
    render(renderControl({ label: "Date", hint: "Shown to the restaurant." }));

    expect(
      screen.getByRole(role, { name: "Date", description: "Shown to the restaurant." }),
    ).toBeDefined();
  });

  test("an error marks it invalid and describes it", () => {
    render(renderControl({ label: "Date", error: "Choose a date." }));
    const control = screen.getByRole(role, { name: "Date", description: "Choose a date." });

    expect(control.getAttribute("aria-invalid")).toBe("true");
  });

  test("an error and a hint can both describe it", () => {
    render(renderControl({ label: "Date", hint: "Shown here.", error: "Choose a date." }));

    expect(
      screen.getByRole(role, { name: "Date", description: "Choose a date. Shown here." }),
    ).toBeDefined();
  });

  test("an error is shown in words, so it doesn't rely on color", () => {
    render(renderControl({ label: "Date", error: "Choose a date." }));

    expect(screen.getByText("Choose a date.").className).toContain("text-error");
  });

  test("disabled reaches the real control", () => {
    render(renderControl({ label: "Date", disabled: true }));

    expect(screen.getByRole<HTMLInputElement>(role, { name: "Date" }).disabled).toBe(true);
  });

  test("a given id is used, and the label still points at it", () => {
    render(renderControl({ id: "booking-date", label: "Date" }));

    expect(screen.getByRole(role, { name: "Date" }).id).toBe("booking-date");
  });
});

test("Input passes on what React Hook Form's register() gives it", async () => {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  const ref = createRef<HTMLInputElement>();
  render(<Input label="Email" name="email" ref={ref} onChange={onChange} onBlur={onBlur} />);
  const input = screen.getByRole("textbox", { name: "Email" });

  await userEvent.type(input, "a");
  await userEvent.tab();

  expect(ref.current).toBe(input);
  expect(input.getAttribute("name")).toBe("email");
  expect(onChange).toHaveBeenCalledOnce();
  expect(onBlur).toHaveBeenCalledOnce();
});

test("a Select can be changed", async () => {
  render(
    <Select label="Date">
      <option>Tonight</option>
      <option>Tomorrow</option>
    </Select>,
  );
  const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Date" });

  await userEvent.selectOptions(select, "Tomorrow");

  expect(select.value).toBe("Tomorrow");
});

test("a Textarea accepts several lines", async () => {
  render(<Textarea label="Note" />);
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Note" });

  await userEvent.type(textarea, "one{Enter}two");

  expect(textarea.value).toBe("one\ntwo");
});

describe("Checkbox", () => {
  const box = (): HTMLInputElement =>
    screen.getByRole<HTMLInputElement>("checkbox", { name: "Remember me" });

  test("clicking the label toggles it", async () => {
    render(<Checkbox label="Remember me" />);

    await userEvent.click(screen.getByText("Remember me"));

    expect(box().checked).toBe(true);
  });

  test("Space toggles it", async () => {
    render(<Checkbox label="Remember me" />);

    await userEvent.tab();
    await userEvent.keyboard(" ");

    expect(box().checked).toBe(true);
  });

  test("disabled ignores clicks and leaves the Tab order", async () => {
    render(<Checkbox label="Remember me" disabled />);

    await userEvent.click(screen.getByText("Remember me"));
    await userEvent.tab();

    expect(box().checked).toBe(false);
    expect(document.activeElement).not.toBe(box());
  });

  test("an error marks it invalid and describes it", () => {
    render(<Checkbox label="Remember me" error="Please accept this." />);

    expect(
      screen.getByRole("checkbox", { name: "Remember me", description: "Please accept this." }),
    ).toBeDefined();
    expect(box().getAttribute("aria-invalid")).toBe("true");
  });

  test("its ref reaches the real checkbox", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox label="Remember me" ref={ref} />);

    expect(ref.current).toBe(box());
  });
});

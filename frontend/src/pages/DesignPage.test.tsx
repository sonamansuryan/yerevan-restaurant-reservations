// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
  spaceTokens,
  typeDetails,
  uiSizes,
} from "@/features/design/tokens";
import { forceStates } from "@/features/design/tools";
import { DesignPage } from "@/pages/DesignPage";

// jsdom can't run the rule copying, which is checked in a browser. This checks the page asks for it.
vi.mock("@/features/design/tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/design/tools")>()),
  forceStates: vi.fn(),
}));

type Entry = { isIntersecting: boolean; target: Element | null };
type Report = (entries: Entry[]) => void;

// jsdom has no IntersectionObserver. This one lets a test say which section is in view. As in a
// browser, each observer hears only about what it observes: the page has more than one, such as
// the home page's evening scene under Screens.
const observers = new Set<FakeIntersectionObserver>();

function reportSections(entries: Entry[]): void {
  for (const observer of observers) {
    const theirs = entries.filter((entry) => entry.target && observer.targets.has(entry.target));
    if (theirs.length > 0) observer.report(theirs);
  }
}

class FakeIntersectionObserver {
  readonly targets = new Set<Element>();
  readonly report: Report;
  constructor(callback: Report) {
    this.report = callback;
    observers.add(this);
  }
  observe(target: Element): void {
    this.targets.add(target);
  }
  disconnect(): void {
    observers.delete(this);
  }
}

class FakeResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  observers.clear();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage(): void {
  render(
    <MemoryRouter>
      <DesignPage />
    </MemoryRouter>,
  );
}

/** A group inside one section, because some titles, such as Accent, appear in two sections. */
function group(sectionId: string, title: string): HTMLElement {
  const section = document.getElementById(sectionId) as HTMLElement;
  const heading = within(section).getByRole("heading", { level: 3, name: title });
  return heading.parentElement as HTMLElement;
}

describe("the page", () => {
  test("it says it's for development only", () => {
    renderPage();

    expect(screen.getByText("Development only")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("The house style");
  });

  test("the tab title names it", () => {
    renderPage();

    expect(document.title).toBe("House style · Seghan");
  });

  test.each(contents.map((entry) => [entry.title, entry.id]))(
    "the contents link to the %s section",
    (title, id) => {
      renderPage();

      const link = screen.getByRole("link", { name: new RegExp(`^${title} `) });

      expect(link.getAttribute("href")).toBe(`#${id}`);
      expect(document.getElementById(id)?.tagName).toBe("SECTION");
    },
  );

  test("each section has a heading and a way back to the contents", () => {
    renderPage();

    const sections = document.querySelectorAll("section[id]");

    expect(sections).toHaveLength(contents.length);
    sections.forEach((section) => {
      expect(within(section as HTMLElement).getAllByRole("heading", { level: 2 })).toHaveLength(1);
      expect(section.querySelector('a[href="#contents"]')).not.toBeNull();
    });
    expect(document.getElementById("contents")).not.toBeNull();
  });

  test("the contents mark the first section at first, then the one in view", () => {
    renderPage();
    const marked = (): string | null | undefined =>
      document.querySelector('#contents [aria-current="location"]')?.getAttribute("href");

    expect(marked()).toBe("#color");

    act(() => {
      reportSections([
        { isIntersecting: false, target: document.getElementById("type") },
        { isIntersecting: true, target: document.getElementById("forms") },
      ]);
    });

    expect(marked()).toBe("#forms");
  });

  test("a section leaving the view doesn't clear the mark", () => {
    renderPage();

    act(() => {
      reportSections([{ isIntersecting: false, target: document.getElementById("color") }]);
    });

    expect(document.querySelector('#contents [aria-current="location"]')).not.toBeNull();
  });
});

describe("every listed token reaches the page", () => {
  const prefixed = [
    ...fontTokens,
    ...typeDetails,
    ...spaceTokens,
    pageWidthToken,
    ...shadowTokens,
    ...ruleShadowTokens,
    ...radiusTokens,
    ...durationTokens,
    ...easingTokens,
    animationToken,
  ].map((token) => `--${token.name}`);
  const plain = [
    ...colorGroups.flatMap((item) => item.tokens).map((token) => token.name),
    ...[...displaySizes, ...uiSizes].map((size) => size.name),
  ];

  test.each([...prefixed, ...plain])("%s", (name) => {
    renderPage();

    const shown = [...document.querySelectorAll("code")].map((code) => code.textContent);

    expect(shown).toContain(name);
  });
});

describe("states", () => {
  test("the page switches the frozen examples on", () => {
    vi.mocked(forceStates).mockClear();

    renderPage();

    expect(forceStates).toHaveBeenCalled();
  });

  test.each(["Primary", "Accent", "Ghost", "Link", "Light"])(
    "%s shows every state, with hover and focus frozen",
    (title) => {
      renderPage();
      const row = group("actions", title);

      for (const state of ["Rest (live)", "Hover", "Focus", "Pressed", "Disabled", "Loading"]) {
        expect(within(row).getByText(state)).toBeDefined();
      }
      const forced = [...row.querySelectorAll("[data-force]")].map((element) =>
        element.getAttribute("data-force"),
      );
      expect(forced).toEqual(["hover", "focus", "hover active"]);
    },
  );

  test.each(["Input", "Select", "Textarea", "Checkbox"])("%s shows hover and focus", (title) => {
    renderPage();

    const forced = [...group("forms", title).querySelectorAll("[data-force]")].map((element) =>
      element.getAttribute("data-force"),
    );

    expect(forced).toContain("hover");
    expect(forced).toContain("focus");
  });

  test("every frozen example is inert, so it can't be clicked or reached with Tab", () => {
    renderPage();

    const frozen = document.querySelectorAll("[data-force]");

    expect(frozen.length).toBeGreaterThan(20);
    frozen.forEach((element) => expect(element.closest("[inert]")).not.toBeNull());
  });

  test("the live examples aren't inert", () => {
    renderPage();

    const live = within(group("actions", "Primary")).getByText("Rest (live)").parentElement;

    expect(live?.querySelector("[inert]")).toBeNull();
    expect(live?.querySelector("button")).not.toBeNull();
  });
});

describe("the protected designs", () => {
  test("all six are shown", () => {
    renderPage();

    expect(document.querySelectorAll("#protected .state-card")).toHaveLength(6);
  });

  test("each sits in a plain box, so the grid can't change it", () => {
    renderPage();

    document.querySelectorAll("#protected .state-card").forEach((card) => {
      expect(card.parentElement?.tagName).toBe("DIV");
      expect(card.parentElement?.className).toBe("");
    });
  });

  test("nothing is forced or frozen inside them, so they stay exactly as they are", () => {
    renderPage();

    const section = document.getElementById("protected");

    expect(section?.querySelector("[data-force]")).toBeNull();
    expect(section?.querySelector("[inert]")).toBeNull();
  });

  test("no class is added to them from outside", () => {
    renderPage();

    const expected = "state-card flex flex-col items-center gap-2 px-6 py-12 text-center";

    document.querySelectorAll("#protected .state-card").forEach((card) => {
      expect(card.className).toBe(expected);
    });
  });
});

describe("what can be tried", () => {
  test.each([
    ["With actions", "Cancel this booking?"],
    ["Without actions", "A note from the house"],
    ["Long content", "Before you book"],
  ])("%s opens a real modal", async (button, title) => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: button }));

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: title })).toBeDefined();
  });

  test("Play the timings moves the dots, and plays them back", async () => {
    renderPage();
    const dot = document.querySelector<HTMLElement>("#motion .size-3");
    const button = screen.getByRole("button", { name: "Play the timings" });

    expect(dot?.style.left).toBe("0px");

    await userEvent.click(button);
    expect(dot?.style.left).toContain("100%");

    await userEvent.click(button);
    expect(dot?.style.left).toBe("0px");
  });

  test("the frame starts on this page at phone width", () => {
    renderPage();

    const frame = document.querySelector<HTMLIFrameElement>("#responsive iframe");

    expect(frame?.getAttribute("src")).toBe("/design");
    expect(frame?.style.width).toBe("390px");
  });

  test("Width sets the frame's real width", async () => {
    renderPage();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Width" }), "1280");

    const frame = document.querySelector<HTMLIFrameElement>("#responsive iframe");

    expect(frame?.style.width).toBe("1280px");
  });

  test("Page changes what the frame shows", async () => {
    renderPage();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Page" }), "/dev/error");

    const frame = document.querySelector<HTMLIFrameElement>("#responsive iframe");

    expect(frame?.getAttribute("src")).toBe("/dev/error");
  });

  test("inside a frame the page doesn't open another one, which would never end", () => {
    vi.stubGlobal("top", {});
    renderPage();

    expect(document.querySelector("#responsive iframe")).toBeNull();
    expect(screen.getByText(/already inside the preview/)).toBeDefined();
  });
});

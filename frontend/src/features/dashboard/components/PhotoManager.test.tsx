// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { PhotoManager } from "@/features/dashboard/components/PhotoManager";
import { samplePhotos, tenPhotos } from "@/features/design/samples";
import { ApiError } from "@/lib/api";

// jsdom has no showModal(), which Modal uses. These open and close it the simple way.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(cleanup);

type Props = ComponentProps<typeof PhotoManager>;

function renderPhotos(props: Partial<Props> = {}): Props {
  const all: Props = {
    photos: samplePhotos,
    restaurantName: "Lori Smokehouse",
    onUpload: vi.fn(),
    onMakeCover: vi.fn(),
    onDelete: vi.fn(),
    ...props,
  };
  render(<PhotoManager {...all} />);
  return all;
}

const picker = (): HTMLInputElement =>
  document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
const photo = (type: string, bytes = 1000): File =>
  new File([new Uint8Array(bytes)], "photo", { type });
// Chosen as a person would, but without the picker's own filter, to try what it would hide.
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ applyAccept: false });

test("the cover comes first, and every photo is named for screen readers", () => {
  renderPhotos();

  const names = screen.getAllByRole("img").map((image) => image.getAttribute("alt"));
  expect(names[0]).toBe("Lori Smokehouse, cover photo");
  expect(names[1]).toBe("Lori Smokehouse, photo 2");
  expect(screen.getByText("5 of 10 photos.", { exact: false })).toBeDefined();
});

test("Add a photo opens the device's own picker", async () => {
  renderPhotos();
  const click = vi.spyOn(picker(), "click");

  await userEvent.click(screen.getByRole("button", { name: "Add a photo" }));

  expect(click).toHaveBeenCalledOnce();
});

test("a JPG, PNG or WebP photo is uploaded", async () => {
  const { onUpload } = renderPhotos();
  const chosen = photo("image/webp");

  await user().upload(picker(), chosen);

  expect(onUpload).toHaveBeenCalledWith(chosen);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("anything else is refused before it's sent, and says why", async () => {
  const { onUpload } = renderPhotos();

  await user().upload(picker(), photo("image/gif"));
  expect(screen.getByRole("alert").textContent).toBe("Choose a JPG, PNG or WebP photo.");

  await user().upload(picker(), photo("image/jpeg", 10 * 1024 * 1024 + 1));
  expect(screen.getByRole("alert").textContent).toBe("Choose a photo under 10 MB.");

  expect(onUpload).not.toHaveBeenCalled();
});

test("Make cover sends that photo's id", async () => {
  const { onMakeCover } = renderPhotos();

  await userEvent.click(screen.getByRole("button", { name: "Make cover, photo 3" }));

  expect(onMakeCover).toHaveBeenCalledWith("sample-photo-3");
  // The cover itself has no such button.
  expect(screen.queryByRole("button", { name: "Make cover, the cover" })).toBeNull();
});

test("Delete asks first, and Keep it changes nothing", async () => {
  const { onDelete } = renderPhotos();

  await userEvent.click(screen.getByRole("button", { name: "Delete, photo 2" }));
  const question = screen.getByRole("dialog", { name: "Delete this photo?" });
  expect(question.textContent).toContain("Guests won’t see it any more.");

  await userEvent.click(within(question).getByRole("button", { name: "Keep it" }));

  expect(onDelete).not.toHaveBeenCalled();
});

test("confirming deletes it, and deleting the cover says the next photo takes over", async () => {
  const { onDelete } = renderPhotos();

  await userEvent.click(screen.getByRole("button", { name: "Delete, the cover" }));
  const question = screen.getByRole("dialog", { name: "Delete this photo?" });
  expect(question.textContent).toContain("the next photo becomes the cover");

  await userEvent.click(within(question).getByRole("button", { name: "Delete photo" }));

  expect(onDelete).toHaveBeenCalledWith("sample-photo-1");
});

test("with ten photos, Add a photo waits, and says why", () => {
  renderPhotos({ photos: tenPhotos });

  expect((screen.getByRole("button", { name: "Add a photo" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(
    screen.getByText("A restaurant can have up to 10 photos. Delete one to add another."),
  ).toBeDefined();
});

test("while a change is sent, the photos' buttons wait", () => {
  renderPhotos({ busy: true });

  const waiting = [
    screen.getByRole("button", { name: "Add a photo" }),
    screen.getByRole("button", { name: "Make cover, photo 2" }),
    screen.getByRole("button", { name: "Delete, photo 2" }),
  ];
  expect(waiting.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
});

test("an upload that failed says so, in the words it came with", () => {
  const failed = new ApiError(0, "UPLOAD_FAILED", "The photo didn’t upload. Please try again.");

  renderPhotos({ error: failed });

  expect(screen.getByRole("alert").textContent).toBe("The photo didn’t upload. Please try again.");
});

test("with no photos, the empty state's button opens the picker too", async () => {
  renderPhotos({ photos: [] });
  const click = vi.spyOn(picker(), "click");

  expect(screen.getByText("No photos yet")).toBeDefined();
  // Two ways in: the button at the top, and the one in the empty state.
  const buttons = screen.getAllByRole("button", { name: "Add a photo" });
  await userEvent.click(buttons[1] as HTMLElement);

  expect(click).toHaveBeenCalledOnce();
});

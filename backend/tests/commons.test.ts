// Photos' details from Wikimedia Commons (src/integrations/wikimedia/commons.ts, task 9.7), with
// fetch replaced and no real waiting: what it asks for, that it keeps its distance, and waits as
// long as Commons asks after a 429. Every other test replaces this module.
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.unmock("../src/integrations/wikimedia/commons.ts");

const { CommonsUnavailableError, commonsPhotos, plainText, setPacing } =
  await import("../src/integrations/wikimedia/commons.ts");

const fetchMock = vi.fn();
const waits: number[] = [];

beforeEach(() => {
  waits.length = 0;
  setPacing({ wait: async (ms) => void waits.push(ms) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const page = (title: string, extra: object = {}) => ({
  title,
  imageinfo: [
    {
      url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${title.slice(5)}`,
      thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/1920px-${title.slice(5)}?utm_source=commons.wikimedia.org&utm_campaign=index`,
      descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
      width: 4032,
      extmetadata: {
        Artist: {
          value: '<a href="//commons.wikimedia.org/wiki/User:Benoit">Beno&amp;ît Prieur</a>',
        },
        LicenseShortName: { value: "CC0" },
      },
    },
  ],
  ...extra,
});

test("one request for the files, a 1920-pixel copy without tracking, the author as plain text and the license", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      query: { pages: [page("File:Dolmama.jpg"), { title: "File:Gone.jpg", missing: true }] },
    }),
  );

  const photos = await commonsPhotos(["File:Dolmama.jpg", "File:Gone.jpg"]);

  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
  expect(url.origin + url.pathname).toBe("https://commons.wikimedia.org/w/api.php");
  expect(url.searchParams.get("titles")).toBe("File:Dolmama.jpg|File:Gone.jpg");
  expect(url.searchParams.get("iiurlwidth")).toBe("1920");
  // A plain name, with no contact details: nothing personal leaves this machine.
  expect(init.headers).toEqual({ "User-Agent": "demo-listings-collector/1.0" });
  expect(photos).toEqual([
    {
      title: "File:Dolmama.jpg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Dolmama.jpg",
      imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/1920px-Dolmama.jpg",
      width: 4032,
      author: "Beno&ît Prieur",
      license: "CC0",
    },
  ]);
  // Commons allows 10 requests a minute without contact details, so each waits 7 seconds first.
  expect(waits).toEqual([7000]);
});

test("more than 50 files go in more than one request, each after the same wait", async () => {
  fetchMock.mockImplementation(async () => Response.json({ query: { pages: [] } }));

  await commonsPhotos(Array.from({ length: 51 }, (_, index) => `File:${index}.jpg`));

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(waits).toEqual([7000, 7000]);
});

test("after a 429 it waits as long as Commons says, then tries once more", async () => {
  fetchMock
    .mockResolvedValueOnce(
      new Response("Too many", { status: 429, headers: { "retry-after": "30" } }),
    )
    .mockResolvedValueOnce(Response.json({ query: { pages: [page("File:Dolmama.jpg")] } }));

  const photos = await commonsPhotos(["File:Dolmama.jpg"]);

  expect(photos).toHaveLength(1);
  expect(waits).toEqual([7000, 30_000, 7000]);
});

test("a second 429, or any other refusal, stops with what Commons said", async () => {
  fetchMock.mockResolvedValue(new Response("Too many", { status: 429 }));
  await expect(commonsPhotos(["File:A.jpg"])).rejects.toBeInstanceOf(CommonsUnavailableError);

  fetchMock.mockResolvedValue(new Response("Down", { status: 503 }));
  await expect(commonsPhotos(["File:A.jpg"])).rejects.toThrow("COMMONS_503");
});

test("plain text from Commons' HTML", () => {
  expect(plainText('<span class="fn">Edgar  Zaqaré</span>&nbsp;')).toBe("Edgar Zaqaré");
  expect(plainText("")).toBeNull();
  expect(plainText(undefined)).toBeNull();
});

// The one module that talks to Geoapify (src/integrations/geoapify/maps.ts), with fetch replaced:
// what it asks for, what it makes of the answers, and that a failure never carries the key. Every
// other test replaces this module itself (tests/setup/outside-services.ts).
import { afterEach, describe, expect, test, vi } from "vitest";

vi.unmock("../src/integrations/geoapify/maps.ts");

const { GEOAPIFY_TIMEOUT_MS, MapUnavailableError, findAddress, mapsEnabled, streetMap } =
  await import("../src/integrations/geoapify/maps.ts");

const fetchMock = vi.fn();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function answer(
  body: ConstructorParameters<typeof Response>[0],
  init: ConstructorParameters<typeof Response>[1] = {},
): void {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(body, init));
}

/** What the module asked for, and how. */
function asked(): { url: URL; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
  return { url: new URL(url), init };
}

test("maps are on when GEOAPIFY_API_KEY is set, as it is in tests", () => {
  expect(mapsEnabled()).toBe(true);
});

describe("findAddress", () => {
  test("looks the address up in Armenia, one result, with a time limit", async () => {
    answer(JSON.stringify({ results: [{ lat: 40.1976, lon: 44.5011 }] }));

    const point = await findAddress("52 Komitas Avenue, Yerevan");

    expect(point).toEqual({ lat: 40.1976, lon: 44.5011 });
    const { url, init } = asked();
    expect(`${url.origin}${url.pathname}`).toBe("https://api.geoapify.com/v1/geocode/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      text: "52 Komitas Avenue, Yerevan",
      filter: "countrycode:am",
      limit: "1",
      format: "json",
      apiKey: "test",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(GEOAPIFY_TIMEOUT_MS).toBe(8000);
  });

  test("an address Geoapify doesn't know is null", async () => {
    answer(JSON.stringify({ results: [] }));

    expect(await findAddress("Nowhere 1")).toBeNull();
  });

  test("a refusal is thrown with its status, and never the key", async () => {
    answer(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const thrown = await findAddress("52 Komitas Avenue, Yerevan").catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(MapUnavailableError);
    expect(thrown).toMatchObject({ code: "GEOCODE_401" });
    expect(String((thrown as Error).message)).not.toContain("apiKey");
  });
});

describe("streetMap", () => {
  const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  test("draws the street around the point: 640 by 400 at twice the pixels, Positron, as a PNG", async () => {
    answer(PNG, { headers: { "content-type": "image/png" } });

    const image = await streetMap({ lat: 40.1976, lon: 44.5011 });

    expect([...image]).toEqual([...PNG]);
    const { url, init } = asked();
    expect(`${url.origin}${url.pathname}`).toBe("https://maps.geoapify.com/v1/staticmap");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      style: "positron",
      width: "640",
      height: "400",
      scaleFactor: "2",
      format: "png",
      center: "lonlat:44.5011,40.1976",
      zoom: "16",
      apiKey: "test",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("a refusal, or an answer that isn't a picture, is thrown", async () => {
    answer("Quota exceeded", { status: 429 });
    await expect(streetMap({ lat: 40, lon: 44 })).rejects.toMatchObject({
      code: "STATIC_MAP_429",
    });

    answer("<html></html>", { headers: { "content-type": "text/html" } });
    await expect(streetMap({ lat: 40, lon: 44 })).rejects.toMatchObject({
      code: "STATIC_MAP_NOT_AN_IMAGE",
    });
  });
});

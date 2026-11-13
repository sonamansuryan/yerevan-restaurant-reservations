// A place's details from OpenStreetMap through Geoapify (src/integrations/geoapify/places.ts, task
// 9.7), with fetch replaced: what it asks for, what it keeps of the answer, and that a failure
// never carries the key. Every other test replaces this module (tests/setup/outside-services.ts).
import { afterEach, describe, expect, test, vi } from "vitest";

vi.unmock("../src/integrations/geoapify/places.ts");

const { PlacesUnavailableError, osmPlace, placeFromDetails } =
  await import("../src/integrations/geoapify/places.ts");

const fetchMock = vi.fn();

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

// Geoapify's answer for Dolmama, cut to what matters.
const dolmama = {
  name: "Դոլմամա",
  name_international: { en: "Dolmama", hy: "Դոլմամա" },
  street: "Pushkin Street",
  housenumber: "10",
  suburb: "Kentron",
  website: "https://www.dolmama.am/",
  contact: { phone: "+374 10 56 13 54", email: "info@dolmama.am" },
  datasource: {
    sourcename: "openstreetmap",
    raw: {
      cuisine: "armenian",
      opening_hours: "Mo-Su 11:00-00:00",
      "addr:street": "Պուշկինի փողոց",
      "addr:housenumber": "10",
      check_date: "2024-10-17",
    },
  },
};

describe("placeFromDetails", () => {
  test("the English name, its own address, district, cuisine, hours and contacts, and no email", () => {
    expect(placeFromDetails("node/6566646015", dolmama)).toEqual({
      osmRef: "node/6566646015",
      nameEn: "Dolmama",
      name: "Դոլմամա",
      street: "Pushkin Street",
      housenumber: "10",
      ownAddress: true,
      district: "Kentron",
      cuisine: "armenian",
      openingHours: "Mo-Su 11:00-00:00",
      phone: "+374 10 56 13 54",
      website: "https://www.dolmama.am/",
      checkDate: "2024-10-17",
    });
  });

  test("a house number Geoapify passes on as a number still counts", () => {
    const numbered = {
      ...dolmama,
      datasource: { raw: { ...dolmama.datasource.raw, "addr:housenumber": 10 } },
    };

    expect(placeFromDetails("node/6566646015", numbered).housenumber).toBe("10");
  });

  test("with no English name, a name in Latin letters is its English one, and an Armenian one isn't", () => {
    const named = (name: string) => ({ ...dolmama, name, name_international: { hy: "Մայիրգ" } });

    expect(placeFromDetails("node/6213329732", named("Mayrig")).nameEn).toBe("Mayrig");
    expect(placeFromDetails("node/6213329732", named("Café 12, Ltd.")).nameEn).toBe(
      "Café 12, Ltd.",
    );
    expect(placeFromDetails("node/6213329732", named("Մայիրգ")).nameEn).toBeNull();
  });

  test("an address from the building it's in, with its house number, is kept", () => {
    const inBuilding = {
      ...dolmama,
      street: "King Pap Street",
      housenumber: "4/6",
      datasource: { raw: { cuisine: "georgian" } },
    };

    expect(placeFromDetails("node/2254360353", inBuilding)).toMatchObject({
      street: "King Pap Street",
      housenumber: "4/6",
      // Not its own address tags: the reviewer is asked to check it.
      ownAddress: false,
    });
  });

  test("a street Geoapify filled in from nearby, without a house number, isn't kept", () => {
    const sherep = {
      ...dolmama,
      street: "King Pap Street",
      housenumber: undefined,
      datasource: { raw: { cuisine: "armenian" } },
    };

    expect(placeFromDetails("node/5299493124", sherep)).toMatchObject({
      street: null,
      housenumber: null,
    });
  });
});

describe("osmPlace", () => {
  test("asks for one place by its OpenStreetMap id, in English, with a time limit", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(Response.json({ features: [{ properties: dolmama }] }));

    const place = await osmPlace("node/6566646015");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://api.geoapify.com/v2/place-details");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      osm_id: "6566646015",
      osm_type: "n",
      features: "details",
      lang: "en",
      apiKey: "test",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(place?.nameEn).toBe("Dolmama");
  });

  test("no such place is null, and a refusal says only its status", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(Response.json({ features: [] }));
    fetchMock.mockResolvedValueOnce(new Response("Invalid apiKey", { status: 401 }));

    expect(await osmPlace("way/1")).toBeNull();
    const refusal = await osmPlace("relation/2").catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(PlacesUnavailableError);
    expect((refusal as Error).message).not.toContain("test");
    expect((refusal as InstanceType<typeof PlacesUnavailableError>).code).toBe("PLACE_401");
  });

  test("anything but an OpenStreetMap id is refused before asking", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(osmPlace("Dolmama")).rejects.toThrow("Not an OpenStreetMap id");
    await expect(osmPlace("node/12a")).rejects.toThrow("Not an OpenStreetMap id");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

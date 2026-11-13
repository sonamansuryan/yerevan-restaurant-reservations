// Runs before every test file, in npm test and npm run test:db alike. Outside services are always
// mocked (general-rules.md), and bookings now email guests in the background, so this replaces the
// modules that talk to Resend, Geoapify, Wikimedia Commons and Cloudinary's copying: no test can ever send an email, ask for a map or a place, or copy a photo. A test that cares sets what
// sendEmail answers, and checks what it was asked to send.
import { vi } from "vitest";

// The same for Geoapify: a test that wants a map says what it answers.
vi.mock("../../src/integrations/geoapify/maps.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/integrations/geoapify/maps.ts")>();
  return {
    ...real,
    // The real check of GEOAPIFY_API_KEY, which a test can turn off.
    mapsEnabled: vi.fn(real.mapsEnabled),
    findAddress: vi.fn(async () => {
      throw new Error("Geoapify is replaced in tests: say what it answers");
    }),
    streetMap: vi.fn(async () => {
      throw new Error("Geoapify is replaced in tests: say what it answers");
    }),
  };
});

// The demo listings' sources (PROJECT_PLAN.md 9.7): OpenStreetMap through Geoapify, Wikimedia
// Commons, and copying a photo to Cloudinary. A test that uses one says what it answers.
vi.mock("../../src/integrations/geoapify/places.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/integrations/geoapify/places.ts")>()),
  osmPlace: vi.fn(async () => {
    throw new Error("Geoapify is replaced in tests: say what it answers");
  }),
}));

vi.mock("../../src/integrations/wikimedia/commons.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/integrations/wikimedia/commons.ts")>()),
  commonsPhotos: vi.fn(async () => {
    throw new Error("Wikimedia Commons is replaced in tests: say what it answers");
  }),
}));

vi.mock("../../src/integrations/cloudinary/remote-photos.ts", () => ({
  copyPhoto: vi.fn(async () => {
    throw new Error("Cloudinary is replaced in tests: say what it answers");
  }),
}));

vi.mock("../../src/integrations/email/resend.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/integrations/email/resend.ts")>()),
  sendEmail: vi.fn(async () => {}),
}));

// Collects the demo listings for review (PROJECT_PLAN.md 9.7): what OpenStreetMap, through our
// Geoapify key, and Wikimedia Commons say about each place in sources.ts, written to listings.json.
// It only reads: nothing is copied, and no database is touched. Run with:
//   npm run demo:collect -w backend
import { writeFileSync } from "node:fs";

import { mapsEnabled } from "../../src/integrations/geoapify/maps.ts";
import { osmPlace } from "../../src/integrations/geoapify/places.ts";
import { commonsPhotos } from "../../src/integrations/wikimedia/commons.ts";
import { collectListings } from "./collect-listings.ts";
import { minutesToTime } from "../../src/lib/time.ts";
import { SOURCES } from "./sources.ts";

const FILE = new URL("./listings.json", import.meta.url);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function main(): Promise<void> {
  if (!mapsEnabled()) throw new Error("Set GEOAPIFY_API_KEY in backend/.env first.");

  console.log(`Reading ${SOURCES.length} places. Commons asks for 7 seconds between requests.`);
  const { listings, refused } = await collectListings(SOURCES, {
    place: osmPlace,
    photos: commonsPhotos,
  });

  writeFileSync(
    FILE,
    `${JSON.stringify(
      {
        // Credited wherever the listings are shown.
        sources: {
          details: "© OpenStreetMap contributors, through Geoapify (Open Database License)",
          photos: "Wikimedia Commons, each photo credited to its author under its own license",
        },
        listings,
      },
      null,
      2,
    )}\n`,
  );

  for (const listing of listings) {
    const days = listing.openingHours
      .map(({ dayOfWeek, opensAt, closesAt }) => {
        return `${DAYS[dayOfWeek]} ${minutesToTime(opensAt)}–${minutesToTime(closesAt)}`;
      })
      .join(", ");
    console.log(`\n${listing.name} (${listing.slug}), ${listing.address}, ${listing.district}`);
    console.log(`  ${listing.cuisines.join(", ")} · ${listing.openingHoursText} → ${days}`);
    console.log(
      `  in OpenStreetMap: ${listing.osmRef ?? "no"}, checked ${listing.checkDate ?? "–"}`,
    );
    for (const [field, pages] of Object.entries(listing.detailSources)) {
      console.log(`  ${field} from: ${pages.join(" · ")}`);
    }
    for (const photo of listing.photos) {
      const license = photo.freeLicense ? "" : " (not free: private demo only)";
      console.log(`  photo: ${photo.credit}${license} · ${photo.pageUrl}`);
    }
    const tables = listing.tables.map(
      ({ label, capacity, zone }) => `${label} ${capacity} ${zone}`,
    );
    console.log(`  tables: ${tables.join(", ")}`);
    if (listing.missing.length > 0) console.log(`  missing: ${listing.missing.join("; ")}`);
  }
  for (const { source, problems } of refused) {
    console.log(`\nLeft out ${source}: ${problems.join("; ")}`);
  }
  console.log(`\n${listings.length} listings written to prisma/demo-listings/listings.json.`);
  if (refused.length > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

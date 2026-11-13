// Imports the reviewed demo listings (PROJECT_PLAN.md 9.7): copies their photos to Cloudinary and
// adds or updates them in yerevan_dev, and nothing else. Run it only once listings.json has been
// approved, after the seed:
//   npm run demo:import -w backend
import { readFileSync } from "node:fs";

import { copyPhoto } from "../../src/integrations/cloudinary/remote-photos.ts";
import { prisma } from "../../src/lib/prisma.ts";
import { SEED_DATABASE } from "../seed-data.ts";
import { importListings, listingsFileSchema } from "./import-listings.ts";

async function main(): Promise<void> {
  // The same one database as the seed.
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (row?.name !== SEED_DATABASE) {
    throw new Error(`Refusing to import into "${row?.name}": only ${SEED_DATABASE}.`);
  }

  const file = listingsFileSchema.parse(
    JSON.parse(readFileSync(new URL("./listings.json", import.meta.url), "utf8")),
  );
  const report = await importListings(prisma, file, copyPhoto);
  console.log(`Imported into ${SEED_DATABASE}:`, report);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

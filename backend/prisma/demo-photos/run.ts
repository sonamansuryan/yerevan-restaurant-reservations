// Gives the six published fictional restaurants their free Unsplash photos (photos.ts), in
// yerevan_dev or in the public demo's seghan_demo, and nothing else. The files themselves are in
// the frontend, in frontend/public/demo-photos. Run it after the seed, which adds the restaurants:
//   npm run demo:photos -w backend
import { prisma } from "../../src/lib/prisma.ts";
import { isSeedDatabase } from "../seed-data.ts";
import { addDemoPhotos } from "./add-photos.ts";

async function main(): Promise<void> {
  // The same two databases as the seed and the import.
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!row || !isSeedDatabase(row.name)) {
    throw new Error(`Refusing to add photos to "${row?.name}": only yerevan_dev and seghan_demo.`);
  }
  const report = await addDemoPhotos(prisma);
  console.log(`Demo photos in ${row.name}:`, report);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

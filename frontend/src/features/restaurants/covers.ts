/**
 * Covers shown whole, never cropped or stretched: on the restaurant's cards and as the large cover
 * on its page, on the paper tint, with space at their sides. Every other cover is cropped to fill
 * its frame. Each is known by its Cloudinary public ID, which the demo import derives from the
 * photo's source (photoPublicId, in backend/prisma/demo-listings/rules.ts), so it stays the same
 * however often the listings are imported.
 *
 * Only Gustav's bar photo (9.7) so far: square, with its sign at the top, so a 4:3 card or the wide
 * cover cut "GUSTAV" to "TAV". Nothing stored tells it apart from another square cover, such as
 * PAUL's, which crops well, so it's named here rather than marked in the database.
 */
const SHOWN_WHOLE = ["seghan/demo-listings/node-12246284869/466cc90a3f0cb4a9"];

/** Whether a cover, by its Cloudinary address, is shown whole rather than cropped to its frame. */
export function isShownWhole(url: string): boolean {
  // The address ends with the public ID, or with it and a file extension.
  const path = url.replace(/\.\w+$/, "");
  return SHOWN_WHOLE.some((publicId) => path.endsWith(`/${publicId}`));
}

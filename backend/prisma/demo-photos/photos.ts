// The six published fictional restaurants' photos: free photos from Unsplash, kept with the
// frontend in frontend/public/demo-photos/<slug>/<n>.webp, never at Cloudinary. Each restaurant has
// a cover showing its room, terrace or table, then three or four of its food, all from one kind of
// kitchen: the cover and four more is what a restaurant's page shows. The Unsplash License lets
// anyone use them free, with no credit required, but each one is credited to its photographer.
import { LOCAL_PHOTO_PREFIX } from "../../src/modules/photos/local-photos.ts";

/** One photo at Unsplash: its id, which is also its page's address, and who took it. */
interface UnsplashPhoto {
  unsplashId: string;
  photographer: string;
}

/** Each fictional restaurant's photos, in order: the cover first. */
export const DEMO_PHOTOS: Readonly<Record<string, readonly UnsplashPhoto[]>> = {
  // Khorovats and slow-smoked meats, cooked over an open grill.
  "lori-smokehouse": [
    { unsplashId: "afOvuzIgxPU", photographer: "amin ramezani" },
    { unsplashId: "pQzdireN2Lc", photographer: "Alex Belogub" },
    { unsplashId: "o__sIR_14dA", photographer: "Gang Hao" },
    { unsplashId: "_aR4l6fj6wQ", photographer: "Emerson Vieira" },
    { unsplashId: "s-Z-h0fEiBM", photographer: "José Ignacio Pompé" },
  ],
  // Modern Armenian plates built around the season (nur: pomegranate), in a warm dining room.
  nurr: [
    { unsplashId: "iFyLBKmCrmQ", photographer: "Brands&People" },
    { unsplashId: "NQZiQxuIyFk", photographer: "Lefteris Kallergis" },
    { unsplashId: "J7pCrGWuXgg", photographer: "Nellie Adamyan" },
    { unsplashId: "b1aT3t3uq2E", photographer: "Gor Davtyan" },
  ],
  // Armenian wines by the glass, with small plates until late at the weekend.
  "tsiran-wine-room": [
    { unsplashId: "ZLsmvlmXcLg", photographer: "Max Griss" },
    { unsplashId: "W3qIf--zZzs", photographer: "Alessio Roversi" },
    { unsplashId: "H5eCU_xNnsM", photographer: "The Cheeserom" },
    { unsplashId: "MdUvgBL7Dg0", photographer: "Andrei Sidorov" },
    { unsplashId: "jLIMiw4w_WY", photographer: "Jessie Maxwell" },
  ],
  // Trout and seafood from the lake and beyond, served simply.
  "sevan-and-salt": [
    { unsplashId: "t_Z2UNmwUuM", photographer: "Heidi Braun" },
    { unsplashId: "Sz0sTpO8U6g", photographer: "David Foodphototasty" },
    { unsplashId: "2xd9c6jQhGs", photographer: "Vitalii Kyktov" },
    { unsplashId: "igtFLRG0tQc", photographer: "Sarda Bamberg" },
    { unsplashId: "qft0cj-wdF0", photographer: "Sunira Moses" },
  ],
  // Shared Middle Eastern plates for bigger groups, around a quiet courtyard.
  "kond-house": [
    { unsplashId: "5yvQqhY2HMY", photographer: "Aysegul Aytören" },
    { unsplashId: "cwuGQc5Rvkk", photographer: "Zion C" },
    { unsplashId: "zyeyksoJf78", photographer: "Chetanya Sharma" },
    { unsplashId: "GdLWD8eWFhI", photographer: "Filipp Romanovski" },
    { unsplashId: "IgGFGxULsWg", photographer: "Louis Hansel" },
  ],
  // Khachapuri, khinkali and Georgian wine at everyday prices.
  "tbilisi-courtyard": [
    { unsplashId: "3MF4N8Ey9_E", photographer: "Kristina Tochilko" },
    { unsplashId: "80V5l40ea4w", photographer: "Kristian Kulijanov" },
    { unsplashId: "Pd92hAA7Qk0", photographer: "Kristian Kulijanov" },
    { unsplashId: "BFdgd6UfZcU", photographer: "Nikita Pishchugin" },
    { unsplashId: "Qa29U4Crvn4", photographer: "Victoria Shes" },
  ],
};

/** One demo photo as it's saved, apart from its restaurant. */
export interface DemoPhotoRow {
  publicId: string;
  url: string;
  isCover: boolean;
  sortOrder: number;
  credit: string;
  creditUrl: string;
}

/**
 * A restaurant's demo photos as they're saved, in order, the cover first. The address is the
 * file's own, as the frontend serves it, so the app shows it as it is: photoUrl() changes only
 * Cloudinary's.
 */
export function demoPhotoRows(slug: string): DemoPhotoRow[] {
  return (DEMO_PHOTOS[slug] ?? []).map(({ unsplashId, photographer }, index) => ({
    publicId: `${LOCAL_PHOTO_PREFIX}${slug}/${index + 1}`,
    url: `/demo-photos/${slug}/${index + 1}.webp`,
    isCover: index === 0,
    sortOrder: index,
    credit: photographer,
    creditUrl: `https://unsplash.com/photos/${unsplashId}`,
  }));
}

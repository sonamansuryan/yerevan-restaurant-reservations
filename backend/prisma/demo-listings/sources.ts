// The real Yerevan restaurants Seghan lists for its demo (PROJECT_PLAN.md 9.7): 10 well-known
// places, each named here by its OpenStreetMap id when it's there, with details checked by hand
// against public listings, its photos, cover first, and sample tables for trying Seghan's booking. This list is the one thing a person
// edits. `npm run demo:collect -w backend` reads what the sources say about it into listings.json,
// which is reviewed before `npm run demo:import -w backend` copies anything.
//
// Photos are Commons file names, free to reuse when credited, or photos from the restaurant's own
// site, credited to it. Those aren't under a free license: they're only for Seghan as a private
// demo, and are replaced, or the restaurant's permission asked, before Seghan is deployed.
//
// The tables are made up, sized for the kind of place, so bookings can be tried: they aren't the
// restaurant's own floor plan, and the restaurant never receives a booking made on Seghan.
import type { ListingSource, OwnPhoto } from "./rules.ts";

const VISIT_YEREVAN = "https://visityerevan.am/restaurants/details";
const SPYUR = "https://www.spyur.am/en/companies";
const YEREMYAN = "https://www.yeremyanprojects.com/en/restaurants";

// Photos from a restaurant's own site, credited to it, with each one's width as reviewed.
function ownPhotos(page: string, credit: string, photos: [string, number][]): OwnPhoto[] {
  return photos.map(([url, width]) => ({ url, page, credit, width }));
}

// Gustav's site serves its photos through Framer, which scales a copy down on request: 2560 pixels
// on the longer side stays within Cloudinary's free plan.
const gustav = (id: string): string =>
  `https://framerusercontent.com/images/${id}.jpg?scale-down-to=2560`;

export const SOURCES: ListingSource[] = [
  {
    osm: "node/12246284869", // Gustav
    tables: { INDOOR: [2, 2, 2, 4, 4, 4, 6], TERRACE: [2, 4], BAR_COUNTER: [2, 2] },
    address: {
      value: "38 Isahakyan Street, Yerevan",
      sources: [`${SPYUR}/53772`, "https://gustav.am/"],
    },
    cuisines: {
      value: ["EUROPEAN"],
      sources: ["https://gustav.am/", "https://www.turntables.am/projects/gustav"],
    },
    openingHours: {
      value: "Mo-Su 11:30-00:00",
      sources: [
        "https://wanderlog.com/place/details/9770916/gustav",
        "https://restaurantguru.com/Gustav-Yerevan-Yerevan",
      ],
    },
    phone: { value: "+374 41 999901", sources: [`${SPYUR}/53772`] },
    website: { value: "https://gustav.am/", sources: ["https://gustav.am/"] },
    description:
      "A French-inspired bistro and cocktail bar by the Cascade, opened in 2023. Its menu runs from smashed burgers to the Gustav Pan, with a sauce of 30 herbs.",
    // The bar is the cover. A crop would cut its sign, so the app shows this photo whole, naming it
    // by its public ID (frontend/src/features/restaurants/covers.ts), which its address decides.
    photos: ownPhotos("https://gustav.am/", "Gustav’s website", [
      ["https://framerusercontent.com/images/YRJtFF3ukvdzLwWlSadNIbsHKY.webp", 1240],
      [gustav("24kcVdYfamZhdQ9heO6FBujA"), 2263],
      [gustav("Ps2kzU87aGLzzlHnMoKY3XG6VM"), 2560],
      [gustav("qtD1flxCy7vG9ExZ2W1vIS4MIJk"), 2560],
      [gustav("IOxTHgC7VpOxWI1bFYLBjPvMU"), 2515],
    ]),
  },
  {
    osm: "node/11197827655", // PAUL, 8 Abovyan Street: hours from OpenStreetMap (Feb 2024)
    tables: { INDOOR: [2, 2, 2, 4, 4, 6], TERRACE: [2, 2, 4] },
    name: { value: "PAUL", sources: [`${VISIT_YEREVAN}/156/en/`, `${SPYUR}/paul-cafe/51095/`] },
    address: {
      value: "8 Abovyan Street, Yerevan",
      sources: [
        `${VISIT_YEREVAN}/156/en/`,
        `${SPYUR}/paul-cafe/51095/`,
        "https://panarmenian.net/eng/news/296134/Galaxy_Group_of_Companies_opening_first_PAUL_venue_in_Yerevan",
      ],
    },
    district: { value: "KENTRON", sources: [`${SPYUR}/paul-cafe/51095/`] },
    cuisines: { value: ["EUROPEAN"], sources: [`${VISIT_YEREVAN}/156/en/`] },
    phone: { value: "+374 44 100400", sources: [`${SPYUR}/paul-cafe/51095/`] },
    website: {
      value: "https://www.instagram.com/paul_armenia/",
      sources: ["https://www.openstreetmap.org/node/11197827655"],
    },
    description:
      "Armenia’s first café of the French bakery PAUL, in an 1884 building on Abovyan Street, open from breakfast.",
    // From Galaxy Group, which owns PAUL Armenia. Its page also has a pre-opening rendering of the
    // café, which isn't a photo, and a model posing outside it, so neither is used. Its bags and
    // boxes are the cover: the name reads on a card however it's cropped, where the bag in a hand
    // loses its top.
    photos: ownPhotos("https://galaxygroup.am/businesses/paul-armenia/", "Galaxy Group’s website", [
      [
        "https://galaxygroup.am/wp-content/uploads/2023/07/350117818_974020643631981_4756760333915973128_n.jpg",
        1440,
      ],
      [
        "https://galaxygroup.am/wp-content/uploads/2023/07/325931322_742322213980162_4619340868305132916_n-1.jpg",
        1440,
      ],
      [
        "https://galaxygroup.am/wp-content/uploads/2023/07/325457543_3284412161820613_1431877487036014389_n.jpg",
        1440,
      ],
    ]),
  },
  {
    osm: "node/5299493124", // Sherep
    tables: { INDOOR: [2, 2, 4, 4, 4, 4, 6, 6, 8, 10], TERRACE: [4, 4] },
    address: {
      value: "1 King Pap Street, Yerevan",
      sources: [`${YEREMYAN}/sherep`, `${VISIT_YEREVAN}/6/en/`],
    },
    // Its own page: “no national affiliation or emphasis”.
    cuisines: { value: ["FUSION"], sources: [`${YEREMYAN}/sherep`, `${VISIT_YEREVAN}/6/en/`] },
    description:
      "By Republic Square, where the old Armenia café stood: an open kitchen and a tonir, and dishes from many countries rather than one.",
    photos: [
      ...ownPhotos(`${YEREMYAN}/sherep`, "Yeremyan Projects’ website", [
        [
          "https://www.yeremyanprojects.com/upload/sherep/579fdeacafc185759b2aaf416217f784.jpg",
          3000,
        ],
        [
          "https://www.yeremyanprojects.com/upload/sherep/b50ac5e9dbcde8f44f2671b4be23d7cb.jpg",
          3000,
        ],
        [
          "https://www.yeremyanprojects.com/upload/sherep/39ac908127a414a8eae6f414a0af5050.jpg",
          3000,
        ],
        [
          "https://www.yeremyanprojects.com/upload/sherep/0ea881387f797cd5bbf706e7f2074b51.jpg",
          3000,
        ],
      ]),
      "File:Lavash baking in a restaurant (Yerevan) June 2023.jpg",
    ],
  },
  {
    osm: "node/5299505621", // Lavash: hours as OpenStreetMap (Jun 2026) and Spyur (Oct 2026) agree
    tables: { INDOOR: [2, 2, 4, 4, 4, 6, 6, 8], TERRACE: [2, 4, 4] },
    description:
      "Traditional Armenian dishes, with lavash from its own tonir, and known for its breakfasts.",
    photos: ownPhotos(`${YEREMYAN}/lavash`, "Yeremyan Projects’ website", [
      ["https://www.yeremyanprojects.com/upload/lavash/c98bc10658d396bdb2761ccf834dd037.jpg", 3000],
      ["https://www.yeremyanprojects.com/upload/lavash/4b6d9bfe20e30d2740ff0eae9521a430.jpg", 3000],
      ["https://www.yeremyanprojects.com/upload/lavash/7ec62a37367c7fd8fee948e2bf0426e3.jpg", 3000],
      ["https://www.yeremyanprojects.com/upload/lavash/6d701fc8915778b929ad1a3e808214ae.jpg", 3000],
      ["https://www.yeremyanprojects.com/upload/lavash/24bdea269826236ee37058a16faa6e00.jpg", 3000],
    ]),
  },
  {
    osm: "node/6566646015", // Dolmama
    tables: { INDOOR: [2, 2, 4, 4, 6, 8], TERRACE: [2, 4, 4] },
    // Its own site; OpenStreetMap says midnight.
    openingHours: { value: "Mo-Su 11:00-23:30", sources: ["https://www.dolmama.am/"] },
    description:
      "Armenian cooking, old and new, in rooms full of art and a courtyard under the vines, with its signature dolma.",
    photos: ownPhotos("https://www.dolmama.am/", "Dolmama’s website", [
      ["https://www.dolmama.am/assets/photos/gallery/dolmama-interior-gold-room-wide.jpeg", 1800],
      ["https://www.dolmama.am/assets/photos/hero-art-room.jpg", 1800],
      ["https://dolmama.am/assets/photos/signature-dolma-new.jpg", 1400],
      ["https://www.dolmama.am/assets/photos/vine-mural-table.jpg", 1400],
      ["https://www.dolmama.am/assets/photos/sunlit-meat-plate.jpg", 1400],
    ]),
  },
  {
    osm: "node/2710667288", // Tavern Yerevan, King Pap Street (once Amiryan Street)
    tables: { INDOOR: [2, 4, 4, 4, 6, 6, 8, 10, 12], VIP: [10] },
    // OpenStreetMap's number is the building's; the restaurant group gives the branch's.
    address: {
      value: "5 King Pap Street, Yerevan",
      sources: [`${YEREMYAN}/tavern-yerevan`, `${SPYUR}/tavern-yerevan/5916/`],
    },
    // Spyur's update (Dec 2025); OpenStreetMap (Sep 2024) says 10:00.
    openingHours: { value: "Mo-Su 09:30-00:00", sources: [`${SPYUR}/tavern-yerevan/5916/`] },
    description:
      "Armenian dishes from old recipes and new, with bread from the tonir. One of four Tavern Yerevan restaurants.",
    // The group's photos serve all four branches; the carved sign is this one's, so it's the cover,
    // and its name reads on a card however it's cropped.
    photos: [
      "File:Tavern Yerevan (Armyrian Street) - 8.JPG",
      ...ownPhotos(`${YEREMYAN}/tavern-yerevan`, "Yeremyan Projects’ website", [
        [
          "https://www.yeremyanprojects.com/upload/tavern/479ff8efb2c63b8d682519c8cfd82778.jpg",
          3000,
        ],
        [
          "https://www.yeremyanprojects.com/upload/tavern/e5c105b1be0e2f854f184c1c4c926bb6.jpg",
          3000,
        ],
        [
          "https://www.yeremyanprojects.com/upload/tavern/f703ff0552d63cd18fbff5b239b8b473.jpg",
          3000,
        ],
        [
          "https://www.yeremyanprojects.com/upload/tavern/d5795d355444873474a6ea22d1acc961.jpg",
          3000,
        ],
      ]),
    ],
  },
  {
    osm: "node/2514048932", // Charentsi 28
    tables: { INDOOR: [2, 2, 4, 4, 6], TERRACE: [2, 4, 4], VIP: [10] },
    name: {
      value: "Charentsi 28",
      sources: [`${VISIT_YEREVAN}/37/en/`, "https://charentsi28.com/"],
    },
    cuisines: {
      value: ["FUSION", "ARMENIAN"],
      sources: ["https://charentsi28.com/", `${VISIT_YEREVAN}/37/en/`],
    },
    openingHours: { value: "Mo-Su 12:00-00:00", sources: ["https://charentsi28.com/"] },
    description:
      "Dishes from around the world, from Western Armenian manti to Mediterranean, Indian and Mexican, in a house with a courtyard.",
    // Its own site's photos are only 1100 pixels wide; the night view is from Commons.
    photos: [
      ...ownPhotos("https://charentsi28.com/", "Charentsi 28’s website", [
        ["https://charentsi28.com/jpg/privateroom.jpg", 1100],
        ["https://charentsi28.com/jpg/paperbride.jpg", 1100],
        ["https://charentsi28.com/jpg/ddmash.jpg", 1100],
        ["https://charentsi28.com/jpg/nachos.jpg", 1100],
      ]),
      "File:Charentsi 28 Restaurant (Yerevan) - 1.JPG",
    ],
  },
  {
    osm: "node/4249207199", // Abovyan 12, the Dalan art gallery's courtyard restaurant
    tables: { TERRACE: [2, 2, 4, 4, 4, 6, 8], INDOOR: [2, 4] },
    openingHours: { value: "Mo-Su 10:00-00:00", sources: ["https://spyur.am/abovyan12"] },
    description:
      "The Dalan art gallery’s courtyard restaurant, with Armenian dishes and many Armenian wines and brandies.",
    photos: [
      ...ownPhotos("https://dalan.am/", "Dalan’s website", [
        ["https://dalan.am/assets/restaurant-and-car-CheoJ9gj.jpeg", 1599],
        ["https://dalan.am/assets/balcony-JNYudQ3v.jpeg", 1440],
        ["https://dalan.am/assets/courtyard-CYwbBe5X.jpeg", 2200],
        ["https://dalan.am/assets/food-B9pKXJNx.jpeg", 1001],
      ]),
      "File:Dalan Restaurant - 3.JPG",
    ],
  },
  {
    osm: "node/2254360353", // Caucasian Captive
    tables: { INDOOR: [2, 2, 4, 4, 4, 6, 6, 8, 10] },
    address: {
      value: "4/6 King Pap Street, Yerevan",
      sources: [`${SPYUR}/kavkazskaya-plennitsa-restaurant/25495/`, `${VISIT_YEREVAN}/269/en/`],
    },
    // Spyur's update (Feb 2026); OpenStreetMap (Sep 2025) says midnight.
    openingHours: {
      value: "Mo-Su 10:00-01:00",
      sources: [`${SPYUR}/kavkazskaya-plennitsa-restaurant/25495/`],
    },
    description:
      "Themed on the 1967 comedy Kidnapping, Caucasian Style, with bronze figures of its three heroes at the door and Caucasian dishes inside.",
    photos: [
      "File:Restoracio Kaŭkazia kaptitino 01.jpg",
      "File:Restoracio Kaŭkazia kaptitino 09.jpg",
      "File:Restoracio Kaŭkazia kaptitino 10.jpg",
      "File:Restoracio Kaŭkazia kaptitino 07.jpg",
      "File:The Caucasian Prisoner 1.jpg",
    ],
  },
  {
    osm: "node/4117504595", // Dargett Craft Beer, 72 Aram Street: a brewpub, with no cuisine listed
    tables: { INDOOR: [2, 4, 4, 6, 8, 8], TERRACE: [4, 4], BAR_COUNTER: [2, 2, 2] },
    description:
      "A craft brewery’s own pub, with its beers on tap, burgers and tarte flambée, and a terrace.",
    photos: [
      "File:Dargett Craft Beer 01.jpg",
      "File:Dargett Craft Beer -2.JPG",
      "File:Dargett Craft Beer -3.JPG",
      "File:Dargett Craft Beer - tarte flambée.JPG",
      "File:Dargett Craft Beer - hamburger et frites.JPG",
    ],
  },
];

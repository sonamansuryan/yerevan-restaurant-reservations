// Rules for an owner's restaurant that need no database: its address on Seghan, and whether it's
// ready for guests. They're plain functions, so they're tested on their own.

/**
 * Armenian letters in Latin, the way Armenian names are usually written in English. Lowercase
 * only, because names are lowercased first.
 */
const ARMENIAN: Record<string, string> = {
  ա: "a",
  բ: "b",
  գ: "g",
  դ: "d",
  ե: "e",
  զ: "z",
  է: "e",
  ը: "y",
  թ: "t",
  ժ: "zh",
  ի: "i",
  լ: "l",
  խ: "kh",
  ծ: "ts",
  կ: "k",
  հ: "h",
  ձ: "dz",
  ղ: "gh",
  ճ: "ch",
  մ: "m",
  յ: "y",
  ն: "n",
  շ: "sh",
  ո: "o",
  չ: "ch",
  պ: "p",
  ջ: "j",
  ռ: "r",
  ս: "s",
  վ: "v",
  տ: "t",
  ր: "r",
  ց: "ts",
  ւ: "v",
  փ: "p",
  ք: "k",
  օ: "o",
  ֆ: "f",
  և: "ev",
};

// At the start of a word, ե is said "ye", ո "vo" and և "yev": Երևան is Yerevan, Ոսկի is Voski.
const WORD_START: Record<string, string> = { ե: "ye", ո: "vo", և: "yev" };

/** A name in Latin letters: Armenian transliterated, and accents dropped, so é becomes e. */
function toLatin(name: string): string {
  return (
    name
      .toLowerCase()
      // ու is one sound, u, so it goes first: Ուրարտու is Urartu.
      .replaceAll("ու", "u")
      .replace(/(^|[^\p{L}])([եոև])/gu, (_match, before: string, letter: string) => {
        return before + (WORD_START[letter] ?? letter);
      })
      .replace(/[ա-և]/g, (letter) => ARMENIAN[letter] ?? "")
      // NFKD splits é into e and an accent mark, and the marks are dropped.
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
  );
}

/** Long enough for any real name, short enough to read in an address. */
export const SLUG_MAX_LENGTH = 60;

/**
 * A restaurant's address on Seghan, made from its name: "Sevan & Salt" is sevan-and-salt, and
 * Ծիրան is tsiran. Only a-z, 0-9 and single dashes. A name in another alphabet, such as Cyrillic,
 * gets "restaurant", and long names stop at the last whole word that fits.
 */
export function slugFromName(name: string): string {
  const words = toLatin(name)
    .replaceAll("&", " and ")
    // An apostrophe joins its word: "Ani's" is anis, not ani-s.
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  let slug = "";
  for (const word of words) {
    const longer = slug ? `${slug}-${word}` : word;
    if (longer.length > SLUG_MAX_LENGTH) break;
    slug = longer;
  }
  // A first word longer than the limit is cut, rather than lost.
  if (!slug && words[0]) slug = words[0].slice(0, SLUG_MAX_LENGTH);
  return slug || "restaurant";
}

/**
 * The first free address for a name: `base` itself, or base-2, base-3 and so on after the highest
 * number taken. `taken` is every slug that starts with `base`. Others among them, such as
 * kond-house for kond, don't count.
 */
export function freeSlug(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  // `base` holds only a-z, 0-9 and dashes, so it's safe in a pattern as it is.
  const numbered = new RegExp(`^${base}-(\\d+)$`);
  let highest = 1;
  for (const slug of taken) {
    const number = numbered.exec(slug)?.[1];
    if (number) highest = Math.max(highest, Number(number));
  }
  return `${base}-${highest + 1}`;
}

/** What a restaurant still needs before guests can see it: a table to book, and hours to book in. */
export type PublishBlocker = "TABLE" | "OPENING_HOURS";

export function publishBlockers(counts: {
  activeTables: number;
  openingHours: number;
}): PublishBlocker[] {
  const missing: PublishBlocker[] = [];
  if (counts.activeTables === 0) missing.push("TABLE");
  if (counts.openingHours === 0) missing.push("OPENING_HOURS");
  return missing;
}

/** Says exactly what to add before publishing, such as "Add your opening hours before you publish." */
export function notReadyMessage(missing: readonly PublishBlocker[]): string {
  const needs = missing.map((blocker) =>
    blocker === "TABLE" ? "at least one table" : "your opening hours",
  );
  return `Add ${needs.join(" and ")} before you publish.`;
}

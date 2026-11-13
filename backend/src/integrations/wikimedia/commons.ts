// Photos' details from Wikimedia Commons (PROJECT_PLAN.md 9.7): where each file is, its size, who
// made it and its license. Only the demo listings' collector asks, never the app itself. Commons
// lets a client that gives no contact details make 10 requests a minute, and Seghan sends none, so
// requests go one at a time, 7 seconds apart, waiting longer whenever Commons asks.
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** A plain name for this client. Contact details would raise the limit, but they'd be personal. */
const USER_AGENT = "demo-listings-collector/1.0";

/** At most this many files in one request, as Commons allows. */
const FILES_PER_REQUEST = 50;

/**
 * The copy Cloudinary fetches: wide enough for any screen, a fraction of an original's size. Commons
 * makes copies in standard widths only, and 1920 is one, so it gives exactly this.
 */
const COPY_WIDTH = 1920;

/** One photo on Commons. */
export interface CommonsPhoto {
  /** Its file name, such as "File:Restaurant Dolmama (Yerevan) May 2018 Entrance.jpg". */
  title: string;
  /** Its page at Commons, with its author, license and history. */
  pageUrl: string;
  /** A copy at most 1920 pixels wide, or the file itself when it's narrower. */
  imageUrl: string;
  /** The file's own width, in pixels. */
  width: number;
  /** As Commons gives them, the author without any formatting, such as "Benoît Prieur" and "CC0". */
  author: string | null;
  license: string | null;
}

/** Commons couldn't be reached, or kept refusing. */
export class CommonsUnavailableError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Wikimedia Commons didn't answer as expected: ${code}`);
    this.name = "CommonsUnavailableError";
    this.code = code;
  }
}

interface Pacing {
  /** The time between two requests, and the wait before trying again when Commons gives none. */
  gapMs: number;
  /** How long to wait, made replaceable so tests needn't. */
  wait: (ms: number) => Promise<void>;
}

const pacing: Pacing = {
  gapMs: 7_000,
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** For tests: no real waiting. */
export function setPacing(next: Partial<Pacing>): void {
  Object.assign(pacing, next);
}

/** HTML such as `<a href="…">Benoît Prieur</a>` as plain text. */
export function plainText(html: unknown): string | null {
  if (typeof html !== "string") return null;
  const tidy = html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return tidy || null;
}

/** A file's address without the tracking Commons adds to it, such as ?utm_source=…. */
function withoutTracking(address: string): string {
  const url = new URL(address);
  url.search = "";
  return url.toString();
}

async function ask(params: Record<string, string>): Promise<unknown> {
  const url = new URL(COMMONS_API);
  for (const [name, value] of Object.entries({ format: "json", formatversion: "2", ...params })) {
    url.searchParams.set(name, value);
  }
  // A second try after a 429, waiting as long as Commons says, and at least the usual gap.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await pacing.wait(pacing.gapMs);
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.status === 429 && attempt === 1) {
      const seconds = Number(response.headers.get("retry-after"));
      await pacing.wait(Math.max(Number.isFinite(seconds) ? seconds * 1000 : 0, pacing.gapMs));
      continue;
    }
    if (!response.ok) throw new CommonsUnavailableError(`COMMONS_${response.status}`);
    return response.json();
  }
  throw new CommonsUnavailableError("COMMONS_429");
}

interface ImageInfo {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  width?: number;
  extmetadata?: Record<string, { value?: unknown }>;
}

/** The details of these files, in no set order. A file Commons doesn't have is left out. */
export async function commonsPhotos(titles: readonly string[]): Promise<CommonsPhoto[]> {
  const photos: CommonsPhoto[] = [];
  for (let start = 0; start < titles.length; start += FILES_PER_REQUEST) {
    const body = (await ask({
      action: "query",
      titles: titles.slice(start, start + FILES_PER_REQUEST).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: String(COPY_WIDTH),
      iiextmetadatafilter: "Artist|LicenseShortName",
    })) as { query?: { pages?: { title?: string; missing?: boolean; imageinfo?: ImageInfo[] }[] } };

    for (const page of body.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (page.missing || !page.title || !info?.url || !info.descriptionurl) continue;
      photos.push({
        title: page.title,
        pageUrl: info.descriptionurl,
        // Commons only makes a narrower copy of a wider file.
        imageUrl: withoutTracking(info.thumburl ?? info.url),
        width: info.width ?? 0,
        author: plainText(info.extmetadata?.["Artist"]?.value),
        license: plainText(info.extmetadata?.["LicenseShortName"]?.value),
      });
    }
  }
  return photos;
}

const CLOUDINARY = "https://res.cloudinary.com/";
const UPLOAD = "/image/upload/";

/**
 * A Cloudinary photo at a given width, in the best format and quality for the browser (f_auto,
 * q_auto), so a phone never downloads a photo sized for a large screen. Any other address is
 * returned as it is.
 */
export function photoUrl(url: string, width: number): string {
  const at = url.indexOf(UPLOAD);
  if (!url.startsWith(CLOUDINARY) || at < 0) return url;
  const split = at + UPLOAD.length;
  return `${url.slice(0, split)}f_auto,q_auto,w_${width}/${url.slice(split)}`;
}

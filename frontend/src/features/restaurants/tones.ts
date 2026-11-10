// The six photo tones from index.css. Written out in full so Tailwind finds each class.
const TONES = ["bg-tone-1", "bg-tone-2", "bg-tone-3", "bg-tone-4", "bg-tone-5", "bg-tone-6"];

/** One of the six tones for a restaurant, the same one every time, so its cover never changes. */
export function toneFor(slug: string): string {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return TONES[hash % TONES.length] ?? "bg-tone-1";
}

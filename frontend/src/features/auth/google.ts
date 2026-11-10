// A Google Client ID: digits, a dash, letters and digits, then Google's own domain.
const CLIENT_ID = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

/**
 * The public Client ID that Google's button needs, from VITE_GOOGLE_CLIENT_ID in frontend/.env.
 * It's null when that's missing or still the placeholder, and then the button is left out, rather
 * than shown and failing when it's clicked. It's read on each call, so tests can set it.
 */
export function googleClientId(): string | null {
  const value = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return value !== undefined && CLIENT_ID.test(value) ? value : null;
}

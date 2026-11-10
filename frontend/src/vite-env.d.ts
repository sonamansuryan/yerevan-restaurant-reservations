// The VITE_ values in frontend/.env, typed. Vite copies each one into the public JavaScript, so
// none of them may be a secret.
interface ImportMetaEnv {
  /** The public Client ID for Google's sign-in button: the same as GOOGLE_CLIENT_ID on the server. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

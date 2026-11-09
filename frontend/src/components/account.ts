import type { AuthUser } from "@/types/api";

/** Who's signed in, and the Sign out action, as the header and the mobile menu show them. */
export interface Account {
  /** The person signed in: null when nobody is, undefined while the app is still asking. */
  user: AuthUser | null | undefined;
  onSignOut: () => void;
  signingOut: boolean;
  /** The last Sign out didn't reach the server, so the person is still signed in. */
  signOutFailed: boolean;
}

/** The first word of a name, for the header, where space is short. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

import type { AstroCookies } from "astro";

// A one-shot message carried across a form's redirect: the action sets it,
// the next page shows it once (as a toast, with confetti for the happy ones)
// and clears it. A cookie rather than a query parameter, so the URLs people
// copy and share stay clean.

export const FLASHES = {
  created: { text: "Your group is ready! Send the invite link to your friends.", party: true },
  joined: { text: "You're in the group! Tap the hours you're free.", party: true },
  saved: { text: "Saved. Your hours are in.", party: false },
  proposed: { text: "Hangout proposed! Everyone gets asked if they're in.", party: true },
  in: { text: "You're in! Pop it in your calendar.", party: true },
  out: { text: "Got it. Maybe next time.", party: false },
  welcome: { text: "Welcome to Hangout! You're all set.", party: true },
  renamed: { text: "Name updated.", party: false },
  signedIn: { text: "You're signed in on this device.", party: false },
  newLink: { text: "New sign-in link made. Old links no longer work.", party: false },
  requested: { text: "Friend request sent!", party: false },
  befriended: { text: "You're friends now!", party: true },
  declined: { text: "Request declined.", party: false },
  unfriended: { text: "Removed from your friends.", party: false },
  hosted: { text: "Your event is live! Invite people or share the link.", party: true },
  going: { text: "You're going! Add it to your calendar.", party: true },
  maybe: { text: "Marked as maybe.", party: false },
  notGoing: { text: "Got it, you can't make it.", party: false },
  waitlisted: {
    text: "It's full, so you're on the waitlist. You'll move in automatically if a spot frees up.",
    party: false,
  },
  invited: { text: "Invites sent.", party: false },
  cancelled: { text: "Event cancelled.", party: false },
  edited: { text: "Event updated. Guests have been told.", party: false },
} as const;

export type Flash = keyof typeof FLASHES;

export function flash(cookies: AstroCookies, kind: Flash): void {
  cookies.set("flash", kind, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 });
}

/** Read the flash, if any, and clear it so it shows exactly once. */
export function takeFlash(cookies: AstroCookies): Flash | undefined {
  const kind = cookies.get("flash")?.value;
  if (!kind) return undefined;
  cookies.delete("flash", { path: "/" });
  return kind in FLASHES ? (kind as Flash) : undefined;
}

import { existsSync } from "node:fs";
import { type Browser, chromium } from "playwright-core";

// A real browser for the checks no HTTP request can make: the keyboard, a
// phone-sized screen, a resize mid-interaction, a slow or dropped
// connection (the HD band: "holds up under use it wasn't designed for").
// It uses whatever Chrome is installed --- the marking environment is Chrome
// --- and these tests skip, saying why, where none is.

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((p): p is string => !!p);

export const chromePath = CANDIDATES.find((p) => existsSync(p));

/** The two marking viewports (course assessment page). */
export const DESKTOP = { width: 1920, height: 1080 };
export const PHONE = { width: 390, height: 844 };
/** The narrowest screen WCAG's reflow rule (1.4.10) asks a page to fit. */
export const SMALLEST = { width: 320, height: 640 };

/** A Cookie header (as spec/people.ts keeps it) as cookies a browser
 *  context can hold, so a page opens as that person. */
export function cookiesFor(baseUrl: string, header = ""): { name: string; value: string; url: string }[] {
  return header
    .split(/;\s*/)
    .filter(Boolean)
    .map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name, value: rest.join("="), url: baseUrl };
    });
}

export async function launch(): Promise<Browser> {
  return chromium.launch({ executablePath: chromePath, headless: true });
}

import { defineMiddleware } from "astro:middleware";
import { takeFlash } from "./lib/flash";
import { currentPerson } from "./lib/identity";

// Uploads carry files and keep their own limit (saveImage, ADR 8); every
// other form is a few short fields, so anything bigger is refused unread.
const UPLOADS = new Set(["/api/photos", "/api/me/avatar"]);
const MAX_FORM_BYTES = 64 * 1024;

// What every response tells the browser. Invite, event and sign-in links
// are secrets in their URLs, so no page hands its address to another site
// (Referer). Nothing is sniffed into another type, framed, or given the
// camera. The CSP allows only this site: every script, style, font, image
// and fetch (the live stream too) is same-origin. Scripts and styles keep
// 'unsafe-inline' because pages carry is:inline scripts (the timezone
// pickers, the group page's first-paint tab) and style="" attributes, and
// Astro's own CSP hashes only the scripts it bundles, not is:inline ones.
// HSTS is ignored over plain http, so it's safe to send locally too.
// Static files (/_astro, favicon) are served by the adapter before this
// runs, so they don't get these: they're same-origin assets, not pages.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const HEADERS = {
  "Content-Security-Policy": CSP,
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

function secure(response: Response): Response {
  for (const [name, value] of Object.entries(HEADERS)) response.headers.set(name, value);
  return response;
}

// Before every page: who's signed in (for the navigation bar and every page
// that needs them), and the flash the last form action left, taken here so
// any page can show it once. Form actions under /api/ leave the flash alone
// --- they're what set it.
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (context.request.method === "POST" && !UPLOADS.has(pathname)) {
    // the declared length: a body sent without one isn't caught here
    const length = Number(context.request.headers.get("content-length") ?? 0);
    if (length > MAX_FORM_BYTES) return secure(new Response("Too large", { status: 413 }));
  }
  context.locals.person = currentPerson(context.cookies);
  if (!pathname.startsWith("/api/")) {
    context.locals.flash = takeFlash(context.cookies);
  }
  return secure(await next());
});

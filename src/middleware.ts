import { defineMiddleware } from "astro:middleware";
import { takeFlash } from "./lib/flash";
import { currentPerson } from "./lib/identity";

// Uploads carry files and keep their own limit (saveImage, ADR 8); every
// other form is a few short fields, so anything bigger is refused unread.
const UPLOADS = new Set(["/api/photos", "/api/me/avatar"]);
const MAX_FORM_BYTES = 64 * 1024;

// Before every page: who's signed in (for the navigation bar and every page
// that needs them), and the flash the last form action left, taken here so
// any page can show it once. Form actions under /api/ leave the flash alone
// --- they're what set it.
export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  if (context.request.method === "POST" && !UPLOADS.has(pathname)) {
    // the declared length: a body sent without one isn't caught here
    const length = Number(context.request.headers.get("content-length") ?? 0);
    if (length > MAX_FORM_BYTES) return new Response("Too large", { status: 413 });
  }
  context.locals.person = currentPerson(context.cookies);
  if (!pathname.startsWith("/api/")) {
    context.locals.flash = takeFlash(context.cookies);
  }
  return next();
});

import { defineMiddleware } from "astro:middleware";
import { takeFlash } from "./lib/flash";
import { currentPerson } from "./lib/identity";

// Before every page: who's signed in (for the navigation bar and every page
// that needs them), and the flash the last form action left, taken here so
// any page can show it once. Form actions under /api/ leave the flash alone
// --- they're what set it.
export const onRequest = defineMiddleware((context, next) => {
  context.locals.person = currentPerson(context.cookies);
  if (!context.url.pathname.startsWith("/api/")) {
    context.locals.flash = takeFlash(context.cookies);
  }
  return next();
});

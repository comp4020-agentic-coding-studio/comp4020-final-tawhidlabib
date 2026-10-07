declare namespace App {
  interface Locals {
    /** The one-shot message the last form action left, taken by the middleware. */
    flash?: import("./lib/flash").Flash;
    /** Who's signed in on this browser, if anyone. */
    person?: import("./lib/people").Person;
  }
}

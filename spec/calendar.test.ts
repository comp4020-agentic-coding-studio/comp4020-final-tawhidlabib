import { describe, expect, inject, it } from "vitest";
import { probe, signedUp, textOf } from "./people";

// Your calendar: every plan you have, from every group and every event, on
// the day it happens and in the list of what's next.

const baseUrl = inject("baseUrl");

describe("calendar", () => {
  it("shows a hangout you're in and an event you're going to, on the right days", async () => {
    const ana = await signedUp(baseUrl, "Ana");

    const created = await ana.post("/api/groups", {
      group: probe("Calendar crew"),
      name: ana.name,
      timezone: "Australia/Sydney",
    });
    const id = (created.headers.get("location") ?? "").split("/").pop();
    const hangout = probe("Dumplings");
    await ana.post(`/api/groups/${id}/hangouts`, { date: "2030-01-08", start: "18", end: "20", title: hangout });

    const gig = probe("Gig");
    await ana.post("/api/events", {
      title: gig,
      date: "2030-01-10",
      start: "19:00",
      end: "22:00",
      visibility: "public",
    });

    const { doc } = await ana.get("/calendar?month=2030-01");
    expect(textOf(doc, '[data-date="2030-01-08"]'), "the hangout on its day").toContain(hangout);
    expect(textOf(doc, '[data-date="2030-01-10"]'), "the event on its day").toContain(gig);
    expect(textOf(doc, '[data-date="2030-01-09"]')).not.toContain(hangout);

    const upNext = textOf(doc, "#up-next");
    expect(upNext).toContain(hangout);
    expect(upNext).toContain(gig);

    const day = (await ana.get("/calendar?month=2030-01&day=2030-01-08")).doc;
    expect(textOf(day, "#day"), "picking a day lists its plans").toContain(hangout);
  });
});

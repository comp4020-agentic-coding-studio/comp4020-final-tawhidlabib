import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp, textOf } from "./people";

// Rules of a plan that polish found missing: what an RSVP deadline closes,
// who hears about a changed name, event changes, plans in the past, and
// votes for options a poll doesn't have.

const baseUrl = inject("baseUrl");

/** An event with room for one, and a deadline that has already passed once
 *  it is edited in (a new event can carry a past deadline too). */
async function eventWithSpot(deadline?: { rsvpByDate: string; rsvpByTime: string }) {
  const host = await signedUp(baseUrl, "Host");
  const fields = {
    title: probe("Deadline dinner"),
    date: "2030-01-13",
    start: "19:00",
    end: "21:00",
    visibility: "public",
    capacity: "1",
    maxPlusOnes: "1",
  };
  const res = await host.post("/api/events", fields);
  const path = res.headers.get("location") ?? "";
  const shareId = path.split("/").pop() ?? "";
  const close = () => host.post(`/api/events/${shareId}/edit`, { ...fields, rsvpByDate: "2020-01-01", rsvpByTime: "09:00", ...deadline });
  return { host, path, shareId, close };
}

describe("after the RSVP deadline", () => {
  it("someone who can't come can still say so, and the first person waiting moves in", async () => {
    const { host, path, shareId, close } = await eventWithSpot();
    const [ana, ben] = await Promise.all([signedUp(baseUrl, "Ana"), signedUp(baseUrl, "Ben")]);
    await ana.post(`/api/events/${shareId}/rsvp`, { response: "going" });
    await ben.post(`/api/events/${shareId}/rsvp`, { response: "going" });
    expect(textOf((await ben.get(path)).doc, "#rsvp-h"), "Ben starts on the waitlist").toMatch(/waitlist/i);
    await close();

    const left = await ana.post(`/api/events/${shareId}/rsvp`, { response: "declined" });
    expect(left.status, "saying can't go after the deadline").toBe(303);
    const doc = (await host.get(path)).doc;
    expect(textOf(doc, "#going"), "Ben moved into Ana's spot").toContain(ben.name);
    expect(textOf(doc, "#going")).not.toContain(ana.name);
  });

  it("maybe still works, but joining as going or adding +1s does not", async () => {
    const { path, shareId, close } = await eventWithSpot();
    const [ana, ben] = await Promise.all([signedUp(baseUrl, "Ana"), signedUp(baseUrl, "Ben")]);
    await ana.post(`/api/events/${shareId}/rsvp`, { response: "going" });
    await close();

    expect((await ana.post(`/api/events/${shareId}/rsvp`, { response: "maybe" })).status).toBe(303);
    expect((await ben.post(`/api/events/${shareId}/rsvp`, { response: "going" })).status, "joining closed").toBe(409);
    expect((await ana.post(`/api/events/${shareId}/rsvp`, { response: "going", plusOnes: "1" })).status, "coming back as going").toBe(409);
    expect(textOf((await ben.get(path)).doc, "#rsvp-h")).toMatch(/closed/i);
  });

  it("the event page offers only the buttons that still work", async () => {
    const { path, close } = await eventWithSpot();
    await close();
    const ben = await signedUp(baseUrl, "Ben");
    const doc = (await ben.get(path)).doc;
    const disabled = (value: string) => doc.querySelector<HTMLButtonElement>(`.rsvp button[value="${value}"]`)?.disabled;
    expect([disabled("going"), disabled("maybe"), disabled("declined")]).toEqual([true, false, false]);
  });
});

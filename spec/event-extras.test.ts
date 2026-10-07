import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp, textOf } from "./people";

// The event extras: an RSVP deadline, a cover, Explore's date filters,
// spots left on every card, and the host editing their event --- where
// raising the spot limit moves people in from the waitlist (ADR 6).

const baseUrl = inject("baseUrl");

const sydneyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());

async function hosted(host: Person, fields: Record<string, string>) {
  const res = await host.post("/api/events", {
    title: probe("Extras"),
    date: "2030-01-20",
    start: "19:00",
    end: "21:00",
    visibility: "public",
    ...fields,
  });
  const path = res.headers.get("location") ?? "";
  return { path, shareId: path.split("/").pop() ?? "" };
}

describe("event extras", () => {
  it("after the RSVP deadline, guests can't answer, and the page says so", async () => {
    const host = await signedUp(baseUrl, "Host");
    const { path, shareId } = await hosted(host, { rsvpByDate: "2026-01-01", rsvpByTime: "12:00" });
    const ben = await signedUp(baseUrl, "Ben");
    expect((await ben.post(`/api/events/${shareId}/rsvp`, { response: "going" })).status).toBe(409);
    expect(textOf((await ben.get(path)).doc, "#rsvp")).toMatch(/closed/i);
    expect(textOf((await host.get(path)).doc, "#going")).not.toContain(ben.name);
  });

  it("before the deadline, the page says when it is", async () => {
    const host = await signedUp(baseUrl, "Host");
    const { path } = await hosted(host, { rsvpByDate: "2030-01-18", rsvpByTime: "18:00" });
    expect(textOf((await host.get(path)).doc, "#rsvp")).toMatch(/RSVP by/i);
  });

  it("an event wears the cover its host picked", async () => {
    const host = await signedUp(baseUrl, "Host");
    const { path } = await hosted(host, { cover: "ocean" });
    expect((await host.get(path)).doc.querySelector('.ev-cover[data-cover="ocean"]')).not.toBeNull();
  });

  it("Explore can show just today's events", async () => {
    const host = await signedUp(baseUrl, "Host");
    const tonight = probe("Tonight");
    const later = probe("Later");
    await hosted(host, { title: tonight, date: sydneyToday(), start: "23:00", end: "23:59" });
    await hosted(host, { title: later });
    const today = (await new Person(baseUrl).get(`/events?when=today&q=${encodeURIComponent(tonight)}`)).doc;
    expect(textOf(today, "#explore .cards")).toContain(tonight);
    const notToday = (await new Person(baseUrl).get(`/events?when=today&q=${encodeURIComponent(later)}`)).doc;
    expect(textOf(notToday, "#explore .cards")).not.toContain(later);
  });

  it("cards say how many spots are left", async () => {
    const host = await signedUp(baseUrl, "Host");
    const title = probe("Small");
    await hosted(host, { title, capacity: "3" });
    const doc = (await new Person(baseUrl).get(`/events?q=${encodeURIComponent(title)}`)).doc;
    expect(textOf(doc, "#explore .cards")).toMatch(/3 spots left/);
  });

  it("the host can edit their event, and nobody else can", async () => {
    const host = await signedUp(baseUrl, "Host");
    const { path, shareId } = await hosted(host, {});
    const renamed = probe("Renamed");
    const ben = await signedUp(baseUrl, "Ben");
    const fields = { title: renamed, date: "2030-01-21", start: "18:00", end: "20:00", visibility: "public" };
    expect((await ben.post(`/api/events/${shareId}/edit`, fields)).status).toBe(403);
    expect((await host.post(`/api/events/${shareId}/edit`, fields)).status).toBe(303);
    expect((await host.get(path)).html).toContain(renamed);
    expect((await host.get(`/e/${shareId}/edit`)).doc.querySelector(`input[name="title"][value="${renamed}"]`)).not.toBeNull();
  });

  it("raising the spot limit moves people in from the waitlist", async () => {
    const host = await signedUp(baseUrl, "Host");
    const { path, shareId } = await hosted(host, { capacity: "1" });
    const [ana, ben] = await Promise.all(["Ana", "Ben"].map((n) => signedUp(baseUrl, n)));
    await ana.post(`/api/events/${shareId}/rsvp`, { response: "going" });
    await ben.post(`/api/events/${shareId}/rsvp`, { response: "going" });
    expect(textOf((await host.get(path)).doc, "#waitlist")).toContain(ben.name);

    await host.post(`/api/events/${shareId}/edit`, {
      title: "Bigger",
      date: "2030-01-20",
      start: "19:00",
      end: "21:00",
      visibility: "public",
      capacity: "2",
    });
    expect(textOf((await host.get(path)).doc, "#going")).toContain(ben.name);
    expect(textOf((await ben.get("/inbox")).doc, "#inbox")).toMatch(/spot/i);
  });
});

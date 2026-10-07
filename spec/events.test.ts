import { describe, expect, inject, it } from "vitest";
import { befriend, Person, probe, signedUp, textOf } from "./people";

// Events, Facebook-style: a public event is for anyone with the link and is
// listed on Explore; a private one is for its host and the people they
// invite, and nobody else can see it (ADR 5).

const baseUrl = inject("baseUrl");

// 10 Jan 2030, 7–10pm in Sydney (AEDT, UTC+11)
const WHEN = { date: "2030-01-10", start: "19:00", end: "22:00" };

async function host(person: Person, fields: Record<string, string | string[]>) {
  const res = await person.post("/api/events", { ...WHEN, location: "The Pier", details: "Bring snacks", ...fields });
  return { res, path: res.headers.get("location") ?? "" };
}

/** The person id the event form offers for inviting a friend, by name. */
async function inviteId(hostPerson: Person, friend: Person): Promise<string> {
  const { doc } = await hostPerson.get("/events/new");
  const label = [...doc.querySelectorAll("label")].find((l) => l.textContent?.includes(friend.name));
  return label?.querySelector<HTMLInputElement>('input[name="invite"]')?.value ?? "";
}

describe("events", () => {
  it("a public event is open to anyone with the link, and listed on Explore", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const title = probe("Sunset picnic");
    const { res, path } = await host(ana, { title, visibility: "public" });
    expect(res.status).toBe(303);
    expect(path).toMatch(/^\/e\/[A-Za-z0-9_-]{10,}$/);

    const stranger = new Person(baseUrl);
    const page = await stranger.get(path);
    expect(page.res.status).toBe(200);
    expect(page.html).toContain(title);
    // Explore shows the soonest 30; a search finds any of them
    const found = await stranger.get(`/events?q=${encodeURIComponent(title)}`);
    expect(textOf(found.doc, "#explore .cards")).toContain(title);
  });

  it("a private event is for the people invited, and nobody else", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    const cat = await signedUp(baseUrl, "Cat");
    await befriend(ana, ben);
    await befriend(ana, cat);

    const title = probe("Secret birthday");
    const { path } = await host(ana, { title, visibility: "private", invite: await inviteId(ana, ben) });

    const bens = await ben.get(path);
    expect(bens.res.status).toBe(200);
    expect(bens.html).toContain(title);
    expect(textOf((await ben.get("/events")).doc, "#yours"), "it's on Ben's events").toContain(title);

    expect((await new Person(baseUrl).get(path)).res.status, "a stranger can't see it").toBe(403);
    expect((await cat.get(path)).res.status, "nor can a friend who wasn't invited").toBe(403);
    const searched = await new Person(baseUrl).get(`/events?q=${encodeURIComponent(title)}`);
    // the results, not the page echoing what was searched for
    expect(textOf(searched.doc, "#explore .cards"), "and a search doesn't find it").not.toContain(title);
  });

  it("saying you're going puts you on the guest list and on your calendar", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    await befriend(ana, ben);
    const title = probe("Dumpling night");
    const { path } = await host(ana, { title, visibility: "private", invite: await inviteId(ana, ben) });
    const shareId = path.split("/").pop();

    expect((await ben.post(`/api/events/${shareId}/rsvp`, { response: "going" })).status).toBe(303);
    expect(textOf((await ana.get(path)).doc, "#going"), "Ben is on Ana's guest list").toContain(ben.name);

    const ics = await fetch(new URL(`/api/events/${shareId}.ics`, baseUrl), {
      headers: { cookie: `hp=${ben.jar.get("hp")}` },
    });
    expect(ics.status).toBe(200);
    expect(ics.headers.get("content-type")).toMatch(/^text\/calendar/);
    const body = await ics.text();
    expect(body).toContain("DTSTART:20300110T080000Z");
    expect(body).toContain("DTEND:20300110T110000Z");
  });
});

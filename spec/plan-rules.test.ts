import { describe, expect, inject, it } from "vitest";
import { befriend, Person, probe, signedUp, textOf } from "./people";
import { listen } from "./stream";

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

// A real 1×1 PNG, for an avatar upload.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

/** Ana shares a group with Ben, hosts a public event Ben answered, and
 *  commented on it. Ben's open pages listen to all three. */
async function worldAround() {
  const ana = await signedUp(baseUrl, "Ana");
  const ben = await signedUp(baseUrl, "Ben");
  const made = await ana.post("/api/groups", { group: probe("Name crew"), name: ana.name, timezone: "Australia/Sydney" });
  const groupId = (made.headers.get("location") ?? "").split("/").pop() ?? "";
  await ben.post(`/api/groups/${groupId}/join`, { name: ben.name });
  const ev = await ana.post("/api/events", { title: probe("Name picnic"), date: "2030-01-11", start: "12:00", end: "14:00", visibility: "public" });
  const shareId = (ev.headers.get("location") ?? "").split("/").pop() ?? "";
  await ben.post(`/api/events/${shareId}/rsvp`, { response: "going" });
  await ana.post("/api/comments", { kind: "event", ref: shareId, body: "See you there" });
  const bens = await listen(ben, [`group:${groupId}`, `event:${shareId}`, `thread:event:${shareId}`]);
  await bens.next((e) => e.event === "hello");
  return { ana, ben, bens, groupId, shareId };
}

describe("a changed name or avatar reaches every open page that shows it", () => {
  it("a new name reaches the group, the event and the plan thread", async () => {
    const { ana, bens, groupId, shareId } = await worldAround();
    const renamed = probe("Anabel");
    await ana.post("/api/me", { name: renamed, back: "/me" });
    await bens.next((e) => e.event === "change" && e.data.topic ===`group:${groupId}`);
    await bens.next((e) => e.event === "change" && e.data.topic ===`event:${shareId}`);
    await bens.next((e) => e.event === "change" && e.data.topic ===`thread:event:${shareId}`);
    expect(JSON.stringify(bens.seen), "the stream says which topic, never the name").not.toContain(renamed);
    bens.close();
  });

  it("a friend's open pages (person:me) hear of the new name", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    await befriend(ana, ben);
    const bens = await listen(ben, ["person:me"]);
    await bens.next((e) => e.event === "hello");
    await ana.post("/api/me", { name: probe("Anabel"), back: "/me" });
    await bens.next((e) => e.event === "change");
    bens.close();
  });

  it("a new emoji avatar reaches the group and the event", async () => {
    const { ana, bens, groupId, shareId } = await worldAround();
    await ana.post("/api/me", { name: ana.name, avatarEmoji: "🦊", back: "/me" });
    await bens.next((e) => e.event === "change" && e.data.topic ===`group:${groupId}`);
    await bens.next((e) => e.event === "change" && e.data.topic ===`event:${shareId}`);
    bens.close();
  });

  it("a new photo avatar, and removing it, reach the group, the event and the thread", async () => {
    const { ana, bens, groupId, shareId } = await worldAround();
    await ana.upload("/api/me/avatar", {}, [{ name: "me.png", type: "image/png", bytes: PNG }]);
    await bens.next((e) => e.event === "change" && e.data.topic ===`group:${groupId}`);
    await bens.next((e) => e.event === "change" && e.data.topic ===`event:${shareId}`);
    await bens.next((e) => e.event === "change" && e.data.topic ===`thread:event:${shareId}`);
    bens.clear();
    await ana.post("/api/me/avatar", { action: "remove" });
    await bens.next((e) => e.event === "change" && e.data.topic ===`group:${groupId}`);
    await bens.next((e) => e.event === "change" && e.data.topic ===`event:${shareId}`);
    bens.close();
  });
});

/** The person id the event form offers for inviting a friend, by name. */
async function inviteId(host: Person, friend: Person): Promise<string> {
  const { doc } = await host.get("/events/new");
  const label = [...doc.querySelectorAll("label")].find((l) => l.textContent?.includes(friend.name));
  return label?.querySelector<HTMLInputElement>('input[name="invite"]')?.value ?? "";
}

const STATES = ["going", "waitlisted", "declined", "maybe", "invited"] as const;

/** A host with a guest in every state, each holding a person:me stream. */
async function eventWithEveryGuest() {
  const host = await signedUp(baseUrl, "Host");
  const guests = Object.fromEntries(await Promise.all(STATES.map(async (n) => [n, await signedUp(baseUrl, n)]))) as Record<(typeof STATES)[number], Person>;
  for (const g of Object.values(guests)) await befriend(host, g);
  const fields = { title: probe("Changing plan"), date: "2030-01-13", start: "19:00", end: "21:00", visibility: "public", capacity: "1" };
  const made = await host.post("/api/events", { ...fields, invite: await Promise.all(Object.values(guests).map((g) => inviteId(host, g))) });
  const shareId = (made.headers.get("location") ?? "").split("/").pop() ?? "";
  await guests.going.post(`/api/events/${shareId}/rsvp`, { response: "going" });
  await guests.waitlisted.post(`/api/events/${shareId}/rsvp`, { response: "going" });
  await guests.maybe.post(`/api/events/${shareId}/rsvp`, { response: "maybe" });
  await guests.declined.post(`/api/events/${shareId}/rsvp`, { response: "declined" });
  const streams = Object.fromEntries(
    await Promise.all(
      STATES.map(async (n) => {
        const s = await listen(guests[n], ["person:me"]);
        await s.next((e) => e.event === "hello");
        return [n, s] as const;
      }),
    ),
  ) as Record<(typeof STATES)[number], Awaited<ReturnType<typeof listen>>>;
  return { host, shareId, fields, guests, streams };
}

describe("event changes reach every guest's own pages", () => {
  it("inviting someone publishes their person topic and tells them", async () => {
    const host = await signedUp(baseUrl, "Host");
    const friend = await signedUp(baseUrl, "Friend");
    await befriend(host, friend);
    const made = await host.post("/api/events", { title: probe("Invite me"), date: "2030-01-13", start: "19:00", end: "21:00", visibility: "private" });
    const shareId = (made.headers.get("location") ?? "").split("/").pop() ?? "";
    const s = await listen(friend, ["person:me"]);
    await s.next((e) => e.event === "hello");
    await host.post(`/api/events/${shareId}/invite`, { invite: await inviteId(host, friend) });
    await s.next((e) => e.event === "change");
    expect(textOf((await friend.get("/inbox")).doc, "#inbox")).toMatch(/invited you/);
    s.close();
  });

  it("editing publishes to every guest, whatever their answer, and tells those still in", async () => {
    const { host, shareId, fields, guests, streams } = await eventWithEveryGuest();
    await host.post(`/api/events/${shareId}/edit`, { ...fields, title: probe("Moved plan"), start: "20:00", end: "22:00" });
    for (const [who, s] of Object.entries(streams)) {
      await s.next((e) => e.event === "change").catch(() => {
        throw new Error(`${who} heard nothing on person:me`);
      });
    }
    for (const who of ["going", "maybe", "waitlisted", "invited"] as const) {
      expect(textOf((await guests[who].get("/inbox")).doc, "#inbox"), `${who} is told it changed`).toMatch(/updated/);
    }
    for (const s of Object.values(streams)) s.close();
  });

  it("cancelling publishes to every guest and tells those who were coming", async () => {
    const { host, shareId, guests, streams } = await eventWithEveryGuest();
    await host.post(`/api/events/${shareId}/cancel`);
    for (const [who, s] of Object.entries(streams)) {
      await s.next((e) => e.event === "change").catch(() => {
        throw new Error(`${who} heard nothing on person:me`);
      });
    }
    for (const who of ["going", "maybe", "waitlisted", "invited"] as const) {
      expect(textOf((await guests[who].get("/inbox")).doc, "#inbox"), `${who} is told it was cancelled`).toMatch(/cancelled/i);
    }
    expect(textOf((await guests.declined.get("/inbox")).doc, "#inbox"), "someone who can't go isn't bothered").not.toMatch(/cancelled/i);
    for (const s of Object.values(streams)) s.close();
  });
});

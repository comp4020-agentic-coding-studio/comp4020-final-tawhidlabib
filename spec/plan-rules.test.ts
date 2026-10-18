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

/** Ana shares a group with Ben, hosts a public event Ben answered, and Ben
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
  await ben.post("/api/comments", { kind: "event", ref: shareId, body: "See you there" });
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

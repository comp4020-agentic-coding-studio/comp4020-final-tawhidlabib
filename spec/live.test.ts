import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp } from "./people";
import { listen } from "./stream";

// Crit 9 (All at once) — the checkable line of its published spec:
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/09-all-at-once/
//
//   "a change one person makes appears in every other open session within
//    about a second, with no reload"
//
// Held at the server, over real event streams: every open page holds one,
// and these check that one person's change reaches another person's stream
// within a second, and that only people a plan is for can listen to it.
// What the page does with the push (re-render in place) is judged in a
// browser; that each page subscribes is checked by its markup.

const baseUrl = inject("baseUrl");
const SECOND = 1000;

async function groupOfTwo() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Live crew"), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop() ?? "";
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  return { ana, ben, path, id };
}

describe("crit 9: real-time", () => {
  it("a friend's saved hours reach your open group page within a second", async () => {
    const { ana, ben, path, id } = await groupOfTwo();
    const page = (await ben.get(path)).doc;
    expect(page.querySelector(`[data-live="group:${id}"]`), "the group page subscribes to its group").not.toBeNull();

    const bens = await listen(ben, [`group:${id}`]);
    expect(bens.status).toBe(200);
    await bens.next((e) => e.event === "hello");

    const started = Date.now();
    await ana.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: ["2030-01-08T18"] });
    await bens.next((e) => e.event === "change" && e.data.topic === `group:${id}`, SECOND);
    expect(Date.now() - started).toBeLessThan(SECOND);
    bens.close();
  });

  it("a comment reaches everyone watching the plan within a second", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const res = await ana.post("/api/events", {
      title: probe("Live gig"),
      date: "2030-01-11",
      start: "20:00",
      end: "23:00",
      visibility: "public",
    });
    const shareId = (res.headers.get("location") ?? "").split("/").pop() ?? "";
    const ben = await signedUp(baseUrl, "Ben");

    const bens = await listen(ben, [`thread:event:${shareId}`]);
    await bens.next((e) => e.event === "hello");
    await ana.post("/api/comments", { kind: "event", ref: shareId, body: "Doors at 8" });
    await bens.next((e) => e.event === "change" && e.data.topic === `thread:event:${shareId}`, SECOND);
    bens.close();
  });

  it("an RSVP reaches the host's open event page within a second", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const res = await ana.post("/api/events", {
      title: probe("Live picnic"),
      date: "2030-01-11",
      start: "12:00",
      end: "14:00",
      visibility: "public",
    });
    const path = res.headers.get("location") ?? "";
    const shareId = path.split("/").pop() ?? "";
    expect((await ana.get(path)).doc.querySelector(`[data-live="event:${shareId}"]`)).not.toBeNull();

    const anas = await listen(ana, [`event:${shareId}`]);
    await anas.next((e) => e.event === "hello");
    const ben = await signedUp(baseUrl, "Ben");
    await ben.post(`/api/events/${shareId}/rsvp`, { response: "going" });
    await anas.next((e) => e.event === "change" && e.data.topic === `event:${shareId}`, SECOND);
    anas.close();
  });

  it("you can see who else is here now", async () => {
    const { ana, ben, id } = await groupOfTwo();
    const anas = await listen(ana, [`group:${id}`]);
    await anas.next((e) => e.event === "hello");
    const bens = await listen(ben, [`group:${id}`]);
    const here = await anas.next(
      (e) =>
        e.event === "presence" &&
        e.data.topic === `group:${id}` &&
        JSON.stringify(e.data.people).includes(ben.name),
      SECOND,
    );
    expect(JSON.stringify(here.data.people)).toContain(ana.name);
    bens.close();
    anas.close();
  });

  it("only the people a plan is for can listen to it", async () => {
    const { id } = await groupOfTwo();
    const ana = await signedUp(baseUrl, "Ana");
    const res = await ana.post("/api/events", {
      title: probe("Secret"),
      date: "2030-01-11",
      start: "12:00",
      end: "14:00",
      visibility: "private",
    });
    const shareId = (res.headers.get("location") ?? "").split("/").pop() ?? "";

    const stranger = new Person(baseUrl);
    expect((await listen(stranger, [`event:${shareId}`])).status, "a private event").toBe(403);
    expect((await listen(stranger, [`group:${id}`])).status, "a group you're not in").toBe(403);
  });
});

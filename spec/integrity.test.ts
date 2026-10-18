import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp, textOf } from "./people";

// Holes found by auditing the app against its own rules: someone already
// going keeps their spot, a lifted cap empties the waitlist, a leaving member
// doesn't take the group's plans with them, a growing free stretch is
// announced once, a repeated hour is harmless, and a lower +1 limit applies
// to guests who already answered.

const baseUrl = inject("baseUrl");

async function event(fields: Record<string, string>) {
  const host = await signedUp(baseUrl, "Host");
  const res = await host.post("/api/events", {
    title: probe("Integrity"),
    date: "2030-02-12",
    start: "19:00",
    end: "21:00",
    visibility: "public",
    ...fields,
  });
  const path = res.headers.get("location") ?? "";
  return { host, path, shareId: path.split("/").pop() ?? "" };
}
const rsvp = (p: Person, shareId: string, plusOnes = 0, response = "going") =>
  p.post(`/api/events/${shareId}/rsvp`, { response, plusOnes: String(plusOnes) });
const edit = (host: Person, shareId: string, fields: Record<string, string>) =>
  host.post(`/api/events/${shareId}/edit`, {
    title: "Edited",
    date: "2030-02-12",
    start: "19:00",
    end: "21:00",
    visibility: "public",
    ...fields,
  });

async function groupOfTwo() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Crew"), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop() ?? "";
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  return { ana, ben, path, id };
}
const notes = async (p: Person, pattern: RegExp) =>
  [...(await p.get("/inbox")).doc.querySelectorAll("#inbox li.note")].filter((li) => pattern.test(li.textContent ?? ""));

describe("holes in the rules", () => {
  it("1. someone already going keeps their spot when they ask for more +1s than fit", async () => {
    const { host, path, shareId } = await event({ capacity: "2", maxPlusOnes: "1" });
    const [a, b, c] = await Promise.all(["A", "B", "C"].map((n) => signedUp(baseUrl, n)));
    await rsvp(a, shareId);
    await rsvp(c, shareId);
    await rsvp(b, shareId);
    await rsvp(a, shareId, 1);
    const doc = (await host.get(path)).doc;
    expect(textOf(doc, "#going"), "A is still going").toContain(a.name);
    expect(textOf(doc, "#waitlist"), "A did not drop to the waitlist").not.toContain(a.name);
    expect(textOf(doc, "#waitlist"), "B was not promoted over A").toContain(b.name);
  });

  it("2. removing the cap moves everyone waiting in", async () => {
    const { host, path, shareId } = await event({ capacity: "1" });
    const [a, b, c] = await Promise.all(["A", "B", "C"].map((n) => signedUp(baseUrl, n)));
    await rsvp(a, shareId);
    await rsvp(b, shareId);
    await rsvp(c, shareId);
    expect(textOf((await host.get(path)).doc, "#waitlist")).toContain(c.name);
    await edit(host, shareId, { capacity: "" });
    const doc = (await host.get(path)).doc;
    expect(textOf(doc, "#going"), "B and C moved in").toContain(b.name);
    expect(textOf(doc, "#going")).toContain(c.name);
    expect(doc.querySelector("#waitlist li"), "nobody is left waiting").toBeNull();
  });

  it("3. a member leaving doesn't delete the plans they proposed", async () => {
    const { ana, ben, path, id } = await groupOfTwo();
    const title = probe("Ben's plan");
    await ben.post(`/api/groups/${id}/hangouts`, { date: "2030-02-12", start: "18", end: "20", title });
    expect(textOf((await ana.get(`${path}?week=2030-02-11`)).doc, "#plans")).toContain(title);
    await ben.post(`/api/groups/${id}/manage`, { action: "leave" });
    expect(textOf((await ana.get(`${path}?week=2030-02-11`)).doc, "#plans"), "the plan outlives its proposer").toContain(title);
  });

  it("4. a growing free stretch is announced once", async () => {
    const { ana, ben, id } = await groupOfTwo();
    const both = async (hours: string[]) => {
      const slot = hours.map((h) => `2030-01-09T${h}`);
      await ana.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot });
      await ben.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot });
    };
    await both(["09"]);
    expect(await notes(ana, /everyone's free/i)).toHaveLength(1);
    await both(["09", "10"]);
    await both(["09", "10", "11"]);
    expect(await notes(ana, /everyone's free/i), "9-10 grew to 9-12: still one announcement").toHaveLength(1);
    expect(await notes(ben, /everyone's free/i)).toHaveLength(1);
  });

  it("5. the same hour twice in one save is not an error", async () => {
    const { ana, id } = await groupOfTwo();
    const res = await ana.post(`/api/groups/${id}/availability`, {
      week: "2030-01-07",
      slot: ["2030-01-09T09", "2030-01-09T09"],
    });
    expect(res.status).toBe(303);
  });

  it("6. lowering the +1 limit trims the +1s guests already have", async () => {
    const { host, path, shareId } = await event({ capacity: "10", maxPlusOnes: "3" });
    const a = await signedUp(baseUrl, "A");
    await rsvp(a, shareId, 3);
    expect(textOf((await host.get(path)).doc, "#going")).toContain("+3");
    await edit(host, shareId, { capacity: "10", maxPlusOnes: "1" });
    const going = textOf((await host.get(path)).doc, "#going");
    expect(going, "A keeps one").toContain("+1");
    expect(going, "and loses two").not.toContain("+3");
  });
});

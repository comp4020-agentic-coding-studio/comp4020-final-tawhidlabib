import { describe, expect, inject, it } from "vitest";
import { Person, probe } from "./people";
import { listen } from "./stream";

// The blind grid (ADR 10): you don't see when anyone else is free until
// you've said when you are, that week. In open scheduling polls people
// answer strategically --- approving slots that look popular, avoiding the
// middle --- rather than honestly (Zou, Meir & Parkes, CSCW 2015), so
// Hangout asks for your honest week first, then shows you the group's.
// Held on the server: the hidden counts and names never leave it.

const baseUrl = inject("baseUrl");
const WEEK = "2030-01-07";
const TUE = "2030-01-08";

async function groupOfTwo() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Blind crew"), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop() ?? "";
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  // Ana marks Tuesday evening
  await ana.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`, `${TUE}T19`] });
  return { ana, ben, page: `${path}?week=${WEEK}`, id };
}

const cell = (doc: Document, slot: string) =>
  doc.querySelector<HTMLInputElement>(`input[name="slot"][value="${slot}"]`)?.closest(".slot");

describe("the blind grid", () => {
  it("before you've marked your week, nobody else's hours are on the page", async () => {
    const { ana, ben, page } = await groupOfTwo();
    const { doc, html } = await ben.get(page);
    expect(cell(doc, `${TUE}T18`)?.getAttribute("data-heat"), "no heat").toBe("0");
    expect(cell(doc, `${TUE}T18`)?.textContent, "no count, no names").not.toContain(ana.name);
    expect(doc.querySelector("#blind-note"), "the page says why").not.toBeNull();
    // not in the People tab's table either, nor as a recommendation
    expect(doc.querySelector("#people-body table.everyone"), "everyone's week waits too").toBeNull();
    expect(html).not.toMatch(/Ana[^<]{0,40} free/);
    expect(doc.querySelector('#best-body form[action$="/hangouts"]'), "no best times yet").toBeNull();
  });

  it("nor does the group's best time show anywhere else first: /groups and home wait too", async () => {
    // the overviews read this week, so this test uses this week's Sunday 11pm
    // (the last hour of the week: it hasn't started yet, so it's recommendable)
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
    const d = new Date(`${today}T00:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
    const sunday = new Date(monday.getTime() + 6 * 86_400_000).toISOString().slice(0, 10);
    const week = monday.toISOString().slice(0, 10);

    const ana = new Person(baseUrl, probe("Ana"));
    const res = await ana.post("/api/groups", { group: probe("Overview crew"), name: ana.name, timezone: "Australia/Sydney" });
    const id = (res.headers.get("location") ?? "").split("/").pop() ?? "";
    const cat = new Person(baseUrl, probe("Cat"));
    await cat.post(`/api/groups/${id}/join`, { name: cat.name });
    for (const p of [ana, cat]) await p.post(`/api/groups/${id}/availability`, { week, slot: [`${sunday}T23`] });
    // From Sunday 11pm in Sydney every hour of this week has started, so no
    // best time exists to leak, and asserting one would fail for the clock,
    // not the app (it did, on a push at 11:21pm on a Sunday). The rest of
    // the test, that Ben sees none before answering, holds at any hour.
    const hour = Number(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" }).format(new Date()));
    const weekOver = today === sunday && hour >= 23;
    if (!weekOver) {
      expect((await ana.get("/groups")).html, "there is a best time, for someone who's answered").toMatch(/Best this week:/);
    }

    const ben = new Person(baseUrl, probe("Ben"));
    await ben.post(`/api/groups/${id}/join`, { name: ben.name });
    for (const path of ["/groups", "/"]) {
      const { html } = await ben.get(path);
      expect(html, `${path} shows no best time before Ben answers`).not.toMatch(/Best this week:|Best: /);
    }
  });

  it("once you've marked yours, the group's week appears", async () => {
    const { ana, ben, page, id } = await groupOfTwo();
    await ben.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`] });
    const { doc } = await ben.get(page);
    expect(cell(doc, `${TUE}T18`)?.getAttribute("data-heat")).not.toBe("0");
    expect(cell(doc, `${TUE}T19`)?.textContent, "Ana's hour shows with her name").toContain(ana.name);
    expect(doc.querySelector("#blind-note")).toBeNull();
    expect(doc.querySelector("#people-body table.everyone")).not.toBeNull();
  });

  it("'none of these work' counts as answering, so you see the group without marking a single hour", async () => {
    const { ben, page, id } = await groupOfTwo();
    expect((await ben.post(`/api/groups/${id}/availability`, { week: WEEK, none: "1" })).status).toBe(303);
    const { doc } = await ben.get(page);
    expect(cell(doc, `${TUE}T18`)?.getAttribute("data-heat")).not.toBe("0");
  });

  it("each week is its own: answering this week doesn't reveal next week", async () => {
    const { ana, ben, id, page } = await groupOfTwo();
    await ana.post(`/api/groups/${id}/availability`, { week: "2030-01-14", slot: ["2030-01-15T18"] });
    await ben.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`] });
    const next = (await ben.get(page.replace(WEEK, "2030-01-14"))).doc;
    expect(cell(next, "2030-01-15T18")?.getAttribute("data-heat")).toBe("0");
  });

  it("the live stream doesn't give it away either: a hidden week pushes no details", async () => {
    const { ana, ben, id } = await groupOfTwo();
    const bens = await listen(ben, [`group:${id}`]);
    await bens.next((e) => e.event === "hello");
    await ana.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T20`] });
    const change = await bens.next((e) => e.event === "change", 1000);
    expect(JSON.stringify(change.data), "only which topic changed").not.toContain(ana.name);
    bens.close();
  });
});

import { describe, expect, inject, it } from "vitest";
import { befriend, friendCode, Person, probe, signedUp } from "./people";

// Holes found in review: a friend code is a secret (like a password for
// friending), so no response may hand one to someone who didn't supply it,
// and a form's `back` may only ever lead somewhere on this site.

const baseUrl = inject("baseUrl");
const NO_SUCH = "2000000000"; // a person id nobody has

/** A group of the given people, the first one making it. */
async function groupOf(...people: Person[]) {
  const [first, ...rest] = people;
  const res = await first.post("/api/groups", { group: probe("Sec crew"), name: first.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop() ?? "";
  for (const p of rest) await p.post(`/api/groups/${id}/join`, { name: p.name });
  return { path, id };
}

/** Someone's person id, as a group-mate sees it on "People you may know". */
async function idSeenBy(viewer: Person, name: string): Promise<string> {
  const { doc } = await viewer.get("/friends");
  const row = [...doc.querySelectorAll("#may-know li")].find((li) => li.textContent?.includes(name));
  return row?.querySelector<HTMLInputElement>('input[name="person"]')?.value ?? "";
}

const requestsOf = async (p: Person) => (await p.get("/friends")).doc.querySelector("#requests")?.textContent ?? "";

describe("friend codes stay secret", () => {
  it("signed out, blocking by id says nothing about the person: same answer as for nobody", async () => {
    const ben = await signedUp(baseUrl, "Ben");
    const cat = await signedUp(baseUrl, "Cat");
    await groupOf(ben, cat);
    const benId = await idSeenBy(cat, ben.name);
    expect(benId, "Cat sees Ben to add").not.toBe("");
    const code = await friendCode(ben);

    const stranger = new Person(baseUrl);
    const real = await stranger.post("/api/blocks", { person: benId });
    const none = await stranger.post("/api/blocks", { person: NO_SUCH });
    expect(real.headers.get("location") ?? "", "a friend code reached a signed-out stranger").not.toContain(code);
    expect(real.headers.get("location")).toBe(none.headers.get("location"));
    expect(real.status).toBe(none.status);
  });

  it("signed in, ids of people you've no reason to know resolve to nobody", async () => {
    const ben = await signedUp(baseUrl, "Ben");
    const cat = await signedUp(baseUrl, "Cat");
    await groupOf(ben, cat);
    const benId = await idSeenBy(cat, ben.name);
    const code = await friendCode(ben);
    const eve = await signedUp(baseUrl, "Eve");

    const blocked = await eve.post("/api/blocks", { person: benId });
    expect(blocked.headers.get("location") ?? "", "a friend code reached a stranger").not.toContain(code);
    expect(blocked.headers.get("location")).toBe((await eve.post("/api/blocks", { person: NO_SUCH })).headers.get("location"));

    await eve.post("/api/friends", { person: benId });
    expect(await requestsOf(ben), "an id alone is no way to send a request").not.toContain(eve.name);

    // the legitimate ways still work: an id from a shared group, and a code
    await cat.post("/api/friends", { person: await idSeenBy(cat, ben.name) });
    expect(await requestsOf(ben)).toContain(cat.name);
    await eve.post("/api/friends", { code });
    expect(await requestsOf(ben), "the code still works").toContain(eve.name);
  });

  it("friends can be blocked and unblocked by id", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    await befriend(ana, ben);
    const { doc } = await ana.get("/friends");
    const id = [...doc.querySelectorAll("#friends li")].find((li) => li.textContent?.includes(ben.name))
      ?.querySelector<HTMLInputElement>('input[name="person"]')?.value ?? "";
    expect(id).not.toBe("");
    await ana.post("/api/blocks", { person: id });
    expect((await ana.get("/friends")).doc.querySelector("#friends")?.textContent, "blocking ends the friendship").not.toContain(ben.name);
    await ana.post("/api/blocks", { person: id, action: "unblock" });
    await ben.post("/api/friends", { code: await friendCode(ana) });
    expect(await requestsOf(ana), "unblocked, so Ben can ask again").toContain(ben.name);
  });
});

describe("a form's `back` stays on this site", () => {
  // Browsers read `/\` as `//`, and strip tabs and newlines inside a URL, so
  // each of these is "go to evil" unless the server refuses it.
  const hostile = ["//evil.example", "/\\evil.example", "/\\\\evil.example", "\t//evil.example", "\n//evil.example", "https://evil.example", "javascript:alert(1)", "/%5Cevil.example", "/ok/../..//evil.example"];

  const sameOrigin = (location: string | null) => {
    expect(location, "a redirect").not.toBeNull();
    const url = new URL(location ?? "", "http://site.test");
    expect(url.origin, `${JSON.stringify(location)} leaves the site`).toBe("http://site.test");
    expect(location, "no backslash for a browser to read as a slash").not.toContain("\\");
    expect(location, "no leading // for a browser to read as a host").not.toMatch(/^\/\//);
  };

  it("a hostile back lands on a same-origin path", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    for (const back of hostile) sameOrigin((await ana.post("/api/blocks", { person: NO_SUCH, back })).headers.get("location"));
  });

  it("a good back is kept, query and all", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const res = await ana.post("/api/blocks", { person: NO_SUCH, back: "/friends?x=1#requests" });
    expect(res.headers.get("location")).toBe("/friends?x=1#requests");
  });
});

describe("an archived group is read-only for joining and nudging too", () => {
  async function archived() {
    const ana = new Person(baseUrl, probe("Ana"));
    const res = await ana.post("/api/groups", { group: probe("Sec archive"), name: ana.name, timezone: "Australia/Sydney" });
    const id = (res.headers.get("location") ?? "").split("/").pop() ?? "";
    const ben = new Person(baseUrl, probe("Ben"));
    await ben.post(`/api/groups/${id}/join`, { name: ben.name });
    await ana.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: ["2030-01-08T18"] }); // answer first, or there is no table
    const { doc } = await ana.get(`/g/${id}?week=2030-01-07`);
    const member = doc.querySelector<HTMLInputElement>('form[action$="/nudge"] input[name="member"]')?.value ?? "";
    expect(member, "Ana can nudge Ben before the archive").not.toBe("");
    await ana.post(`/api/groups/${id}/manage`, { action: "archive" });
    return { ana, ben, id, member };
  }

  it("no one can join", async () => {
    const { id } = await archived();
    const late = new Person(baseUrl, probe("Late"));
    expect((await late.post(`/api/groups/${id}/join`, { name: late.name })).status).toBe(409);
    expect((await late.get(`/g/${id}`)).html, "and isn't in it").not.toContain(late.name);
  });

  it("no one can be nudged", async () => {
    const { ana, ben, id, member } = await archived();
    const week = mondayOf(new Date());
    expect((await ana.post(`/api/groups/${id}/nudge`, { member, week })).status).toBe(409);
    expect((await ben.get("/inbox")).doc.querySelector("#inbox")?.textContent ?? "", "Ben heard nothing").not.toMatch(/nudged/);
  });
});

/** This week's Monday (UTC), as the form sends it. */
function mondayOf(now: Date): string {
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

describe("a nudge is for a real week near now", () => {
  it("refuses a Monday far in the past or the future, and a day that isn't a Monday", async () => {
    const ana = new Person(baseUrl, probe("Ana"));
    const res = await ana.post("/api/groups", { group: probe("Sec weeks"), name: ana.name, timezone: "Australia/Sydney" });
    const id = (res.headers.get("location") ?? "").split("/").pop() ?? "";
    const ben = new Person(baseUrl, probe("Ben"));
    await ben.post(`/api/groups/${id}/join`, { name: ben.name });
    await ana.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: ["2030-01-08T18"] }); // answer first, or there is no table
    const { doc } = await ana.get(`/g/${id}?week=2030-01-07`);
    const member = doc.querySelector<HTMLInputElement>('form[action$="/nudge"] input[name="member"]')?.value ?? "";
    expect(member).not.toBe("");

    for (const week of ["2099-01-05", "1999-01-04", "2030-01-08"]) {
      const sent = await ana.post(`/api/groups/${id}/nudge`, { member, week });
      expect(sent.headers.get("location"), `${week} is no week to nudge for`).not.toContain("week=");
    }
    expect((await ben.get("/inbox")).doc.querySelector("#inbox")?.textContent ?? "").not.toMatch(/nudged/);
    const now = await ana.post(`/api/groups/${id}/nudge`, { member, week: mondayOf(new Date()) });
    expect(now.headers.get("location"), "this week still works").toContain("week=");
  });
});

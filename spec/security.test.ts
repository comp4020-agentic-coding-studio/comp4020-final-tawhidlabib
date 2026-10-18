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

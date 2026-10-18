import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp } from "./people";

// Endpoints the other files only touched in passing: a new sign-in link
// retires the old one, only the host cancels, inviting a whole group, and a
// hangout as a calendar file.

const baseUrl = inject("baseUrl");
const WHEN = { date: "2030-02-12", start: "19:00", end: "21:00" };

const linkOf = async (p: Person) => /\/me\/sign-in\/([A-Za-z0-9_-]+)/.exec((await p.get("/me")).html)?.[1] ?? "";

/** Someone with a profile starts a group; returns its id. */
async function startGroup(ana: Person): Promise<string> {
  const res = await ana.post("/api/groups", { group: probe("Coverage crew"), name: ana.name, timezone: "Australia/Sydney" });
  return (res.headers.get("location") ?? "").split("/").pop()?.split("?")[0] ?? "";
}

describe("a new sign-in link", () => {
  it("retires the old one, and every device still using it", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const oldToken = await linkOf(ana);
    expect(oldToken, "Ana has a sign-in link").not.toBe("");
    const otherDevice = new Person(baseUrl);
    otherDevice.jar.set("hp", ana.jar.get("hp") ?? "");
    expect((await otherDevice.get("/me")).html, "the other device is Ana").toContain(oldToken);

    expect((await ana.post("/api/me/link")).status).toBe(303);
    const newToken = await linkOf(ana);
    expect(newToken, "a different link").not.toBe("");
    expect(newToken).not.toBe(oldToken);

    const stale = new Person(baseUrl);
    expect((await stale.get(`/me/sign-in/${oldToken}`)).res.status, "the old link's page is gone").toBe(404);
    const tried = await stale.post("/api/me/sign-in", { token: oldToken });
    expect(tried.headers.get("location")).toContain("error=bad-link");
    expect(stale.jar.get("hp"), "and signs nobody in").toBeUndefined();

    expect((await otherDevice.get("/me")).html, "the old cookie on another device is no longer Ana").not.toContain(newToken);
    expect((await otherDevice.get("/me")).html).not.toContain(oldToken);

    const fresh = new Person(baseUrl);
    expect((await fresh.get(`/me/sign-in/${newToken}`)).res.status).toBe(200);
    const ok = await fresh.post("/api/me/sign-in", { token: newToken });
    expect(ok.headers.get("location")).toBe("/");
    expect((await fresh.get("/me")).html, "the new link signs in as Ana").toContain(newToken);
  });
});

describe("cancelling an event", () => {
  it("is the host's alone, and the event is then gone for everyone", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    const res = await ana.post("/api/events", { title: probe("Doomed"), visibility: "public", ...WHEN });
    const path = res.headers.get("location") ?? "";
    expect(path).toMatch(/^\/e\//);
    const cancel = `${path.replace("/e/", "/api/events/")}/cancel`;
    expect((await ben.get(path)).res.status, "Ben can see it").toBe(200);

    expect((await ben.post(cancel)).status, "a guest can't cancel").toBe(403);
    expect((await new Person(baseUrl).post(cancel)).status, "nor a stranger").toBe(403);
    expect((await ana.get(path)).res.status, "still on after the attempts").toBe(200);

    expect((await ana.post(cancel)).status).toBe(303);
    for (const who of [ana, ben, new Person(baseUrl)]) {
      expect((await who.get(path)).res.status).toBe(404);
    }
  });
});

describe("inviting a whole group to an event", () => {
  it("lets its members see a private event, and nobody else", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    const cat = await signedUp(baseUrl, "Cat");
    const groupId = await startGroup(ana);
    expect(groupId, "Ana started a group").not.toBe("");
    expect((await ben.post(`/api/groups/${groupId}/join`, { name: ben.name })).status).toBe(303);

    const res = await ana.post("/api/events", { title: probe("Group only"), visibility: "private", ...WHEN });
    const path = res.headers.get("location") ?? "";
    expect((await ben.get(path)).res.status, "before the invite, Ben can't see it").toBe(403);

    const shareId = path.split("/").pop();
    expect((await ana.post(`/api/events/${shareId}/invite`, { inviteGroup: groupId })).status).toBe(303);
    expect((await ben.get(path)).res.status, "the group's member can").toBe(200);
    expect((await cat.get(path)).res.status, "a non-member still can't").toBe(403);
  });
});

describe("a hangout as a calendar file", () => {
  it("goes to the group's members, not strangers", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const groupId = await startGroup(ana);
    const title = probe("Calendar plan");
    await ana.post(`/api/groups/${groupId}/hangouts`, { date: "2030-02-13", start: "18", end: "20", title });
    const { doc } = await ana.get(`/g/${groupId}`);
    const href = doc.querySelector<HTMLAnchorElement>('a[href^="/api/hangouts/"][href$=".ics"]')?.getAttribute("href") ?? "";
    expect(href, "the group page links the .ics").toMatch(/^\/api\/hangouts\/\d+\.ics$/);

    const mine = await ana.get(href);
    expect(mine.res.status).toBe(200);
    expect(mine.res.headers.get("content-type")).toMatch(/^text\/calendar/);
    expect(mine.html).toContain("BEGIN:VCALENDAR");
    expect(mine.html).toContain(title);

    expect((await new Person(baseUrl).get(href)).res.status, "a stranger is refused").toBe(403);
  });
});

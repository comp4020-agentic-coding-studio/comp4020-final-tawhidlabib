import { describe, expect, inject, it } from "vitest";
import { befriend, friendCode, Person, probe, signedUp, textOf } from "./people";

// Profiles grow: an emoji or photo avatar and a bio, shown on your friend
// link. And two ways to have less of someone: block a person (no requests,
// invites or notifications from them, and their comments hidden from you),
// or mute a group (no notifications from it).

const baseUrl = inject("baseUrl");

const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("profiles: avatar and bio", () => {
  it("a bio and an emoji avatar show on your friend link", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const bio = probe("Board games and long walks");
    expect((await ana.post("/api/me", { name: ana.name, bio, avatarEmoji: "🐙", back: "/me" })).status).toBe(303);
    expect((await ana.get("/me")).html).toContain(bio);

    const card = (await new Person(baseUrl).get(`/f/${await friendCode(ana)}`)).doc;
    expect(card.body.textContent).toContain(bio);
    expect(card.querySelector(".avatar")?.textContent).toContain("🐙");
  });

  it("a photo avatar is anyone's to see, and must be an image", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ok = await ana.upload("/api/me/avatar", {}, [{ name: "me.png", type: "image/png", bytes: PNG }]);
    expect(ok.status).toBe(303);
    const src = (await ana.get("/me")).doc.querySelector(".me-link img")?.getAttribute("src") ?? "";
    expect(src).toMatch(/^\/avatars\//);
    const res = await fetch(new URL(src, baseUrl));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");

    const fake = { name: "x.png", type: "image/png", bytes: new TextEncoder().encode("not an image") };
    expect((await ana.upload("/api/me/avatar", {}, [fake])).status).toBe(415);
  });
});

describe("block", () => {
  it("someone you've blocked can't send you a friend request", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    expect((await ben.post("/api/blocks", { code: await friendCode(ana), action: "block" })).status).toBe(303);
    await ana.post("/api/friends", { code: await friendCode(ben) });
    expect(textOf((await ben.get("/friends")).doc, "#requests")).not.toContain(ana.name);
  });

  it("blocking ends a friendship, hides their comments from you, and stops their notifications", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    const cat = await signedUp(baseUrl, "Cat");
    await befriend(ana, ben);
    const res = await ben.post("/api/events", {
      title: probe("Ben's party"),
      date: "2030-01-16",
      start: "19:00",
      end: "22:00",
      visibility: "public",
    });
    const path = res.headers.get("location") ?? "";
    const shareId = path.split("/").pop() ?? "";

    await ben.post("/api/blocks", { code: await friendCode(ana), action: "block" });
    expect(textOf((await ben.get("/friends")).doc, "#friends"), "no longer friends").not.toContain(ana.name);

    const words = probe("Can I come?");
    await ana.post("/api/comments", { kind: "event", ref: shareId, body: words });
    expect((await ben.get(path)).html, "hidden from Ben").not.toContain(words);
    expect((await cat.get(path)).html, "but not from everyone else").toContain(words);
    expect(textOf((await ben.get("/inbox")).doc, "#inbox"), "and Ben isn't notified").not.toContain(words);

    await ben.post("/api/blocks", { code: await friendCode(ana), action: "unblock" });
    expect((await ben.get(path)).html, "unblocking shows it again").toContain(words);
  });
});

describe("mute a group", () => {
  it("a muted group's news stays out of your inbox until you unmute it", async () => {
    const ana = new Person(baseUrl, probe("Ana"));
    const res = await ana.post("/api/groups", { group: probe("Noisy crew"), name: ana.name, timezone: "Australia/Sydney" });
    const id = (res.headers.get("location") ?? "").split("/").pop() ?? "";
    const ben = new Person(baseUrl, probe("Ben"));
    await ben.post(`/api/groups/${id}/join`, { name: ben.name });

    expect((await ben.post(`/api/groups/${id}/mute`, { muted: "1" })).status).toBe(303);
    const quiet = probe("Quiet plan");
    await ana.post(`/api/groups/${id}/hangouts`, { date: "2030-01-09", start: "18", end: "20", title: quiet });
    expect(textOf((await ben.get("/inbox")).doc, "#inbox")).not.toContain(quiet);

    await ben.post(`/api/groups/${id}/mute`, { muted: "0" });
    const loud = probe("Loud plan");
    await ana.post(`/api/groups/${id}/hangouts`, { date: "2030-01-10", start: "18", end: "20", title: loud });
    expect(textOf((await ben.get("/inbox")).doc, "#inbox")).toContain(loud);
  });
});

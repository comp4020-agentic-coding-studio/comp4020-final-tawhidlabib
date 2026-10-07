import { describe, expect, inject, it } from "vitest";
import { befriend, friendCode, signedUp, textOf } from "./people";

// Friends: you add someone by their friend link, and they accept. Nobody can
// find you without your link, and a request isn't a friendship until it's
// accepted.

const baseUrl = inject("baseUrl");

describe("friends", () => {
  it("adding someone's friend link sends them a request to accept", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");

    const code = await friendCode(ana);
    expect(code, "/friends should show your friend link").not.toBe("");

    const landing = await ben.get(`/f/${code}`);
    expect(landing.res.status).toBe(200);
    expect(landing.html).toContain(ana.name);
    expect(landing.doc.querySelector('form[action="/api/friends"]')).not.toBeNull();

    expect((await ben.post("/api/friends", { code })).status).toBe(303);
    const anas = (await ana.get("/friends")).doc;
    expect(textOf(anas, "#requests"), "Ana should see Ben's request").toContain(ben.name);
    expect(textOf(anas, "#friends"), "a request isn't a friendship yet").not.toContain(ben.name);
    expect(textOf((await ben.get("/friends")).doc, "#friends")).not.toContain(ana.name);
  });

  it("once accepted, each of you lists the other as a friend", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    await befriend(ana, ben);

    const anas = (await ana.get("/friends")).doc;
    expect(textOf(anas, "#friends")).toContain(ben.name);
    expect(textOf(anas, "#requests")).not.toContain(ben.name);
    expect(textOf((await ben.get("/friends")).doc, "#friends")).toContain(ana.name);
  });

  it("you can't befriend yourself", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    await ana.post("/api/friends", { code: await friendCode(ana) });
    const { doc } = await ana.get("/friends");
    expect(textOf(doc, "#friends")).not.toContain(ana.name);
    expect(textOf(doc, "#requests")).not.toContain(ana.name);
  });
});

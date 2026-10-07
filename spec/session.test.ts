import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp } from "./people";

// The front door and the way out. The logo always goes to the landing page
// --- the one you see before you have a profile --- even when you're signed
// in. Logging out forgets you on this browser (your profile and every
// group's cookie), and your private sign-in link brings you back.

const baseUrl = inject("baseUrl");

describe("the logo and logging out", () => {
  it("the logo goes to the landing page, even signed in", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const { doc } = await ana.get("/me");
    const logo = doc.querySelector("header.site a.brand")?.getAttribute("href") ?? "";
    expect(logo).toBe("/welcome");

    const landing = await ana.get(logo);
    expect(landing.res.status).toBe(200);
    expect(landing.doc.querySelector("#hero-title"), "the landing page's hero").not.toBeNull();
    expect(landing.doc.querySelector('form[action="/api/groups"]'), "with its start-a-group form").not.toBeNull();
    expect(landing.html, "not the signed-in dashboard").not.toContain(`Hi, ${ana.name.split(" ")[0]}`);
  });

  it("/me has a log out button, and logging out forgets you on this browser", async () => {
    const ana = new Person(baseUrl, probe("Ana"));
    const created = await ana.post("/api/groups", { group: probe("Logout crew"), name: ana.name, timezone: "Australia/Sydney" });
    const group = created.headers.get("location") ?? "";

    const me = (await ana.get("/me")).doc;
    expect(me.querySelector('form[action="/api/me/logout"]'), "a log out button on /me").not.toBeNull();
    const link = /\/me\/sign-in\/[A-Za-z0-9_-]+/.exec((await ana.get("/me")).html)?.[0] ?? "";

    const out = await ana.post("/api/me/logout");
    expect(out.status).toBe(303);
    expect(out.headers.get("location")).toBe("/welcome");
    expect(ana.jar.has("hp"), "the profile cookie is gone").toBe(false);
    expect([...ana.jar.keys()].some((k) => k.startsWith("hg_")), "and every group's cookie").toBe(false);

    expect((await ana.get("/me")).html, "/me doesn't know you").not.toContain(ana.name);
    expect((await ana.get(group)).doc.querySelector('input[name="slot"]'), "nor does your group").toBeNull();

    // the private sign-in link brings you back, groups and all
    await ana.post("/api/me/sign-in", { token: link.split("/").pop() ?? "" });
    expect((await ana.get("/me")).html).toContain(ana.name);
    expect((await ana.get(group)).doc.querySelector('input[name="slot"]')).not.toBeNull();
  });

  it("logging out when you're not signed in does no harm", async () => {
    const res = await new Person(baseUrl).post("/api/me/logout");
    expect(res.status).toBe(303);
  });
});

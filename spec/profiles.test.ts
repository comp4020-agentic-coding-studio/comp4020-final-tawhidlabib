import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp } from "./people";

// A person exists across groups as a profile: a name this browser remembers,
// and a private sign-in link for other devices. No passwords (ADR 4).

const baseUrl = inject("baseUrl");

describe("profiles", () => {
  it("making a profile remembers you, and /me says who you are", async () => {
    const ana = new Person(baseUrl, probe("Ana"));
    const res = await ana.post("/api/me", { name: ana.name, timezone: "Australia/Sydney", back: "/me" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/me");

    const { html } = await ana.get("/me");
    expect(html).toContain(ana.name);
  });

  it("your private sign-in link makes another device you", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const { html } = await ana.get("/me");
    const link = /\/me\/sign-in\/[A-Za-z0-9_-]+/.exec(html)?.[0];
    expect(link, "/me should show your private sign-in link").toBeTruthy();

    const phone = new Person(baseUrl);
    const landing = await phone.get(link ?? "");
    expect(landing.res.status).toBe(200);
    expect(landing.html, "the sign-in page should say whose profile it is").toContain(ana.name);

    // a button, not the GET itself: link previews mustn't sign anyone in
    expect((await phone.get("/me")).html).not.toContain(ana.name);
    const token = (link ?? "").split("/").pop() ?? "";
    expect((await phone.post("/api/me/sign-in", { token })).status).toBe(303);
    expect((await phone.get("/me")).html).toContain(ana.name);
  });

  it("starting a group makes you a profile, and the group is yours on /groups", async () => {
    const ana = new Person(baseUrl, probe("Ana"));
    const group = probe("Climbing crew");
    const res = await ana.post("/api/groups", { group, name: ana.name, timezone: "Australia/Sydney" });
    const path = res.headers.get("location") ?? "";

    // only the profile cookie: the group comes from who you are, not a per-group cookie
    const profileOnly = new Person(baseUrl, ana.name);
    profileOnly.jar.set("hp", ana.jar.get("hp") ?? "");
    const { doc } = await profileOnly.get("/groups");
    const link = doc.querySelector(`a[href="${path}"]`);
    expect(link, "/groups should list the group you started").not.toBeNull();
    expect(link?.textContent).toContain(group);
  });

  it("someone with a profile joins a group in one tap, as themselves", async () => {
    const host = new Person(baseUrl, probe("Host"));
    const res = await host.post("/api/groups", {
      group: probe("Board games"),
      name: host.name,
      timezone: "Australia/Sydney",
    });
    const path = res.headers.get("location") ?? "";
    const id = path.split("/").pop();

    const ben = await signedUp(baseUrl, "Ben");
    const invited = await ben.get(path);
    const oneTap = invited.doc.querySelector<HTMLFormElement>(`form[action="/api/groups/${id}/join"]`);
    expect(oneTap?.textContent, "the join page should offer to join as you").toContain(
      `Join as ${ben.name}`,
    );

    expect((await ben.post(`/api/groups/${id}/join`, { name: ben.name })).status).toBe(303);
    const profileOnly = new Person(baseUrl, ben.name);
    profileOnly.jar.set("hp", ben.jar.get("hp") ?? "");
    const member = await profileOnly.get(path);
    expect(
      member.doc.querySelector('input[name="slot"]'),
      "your profile alone should get you into groups you've joined",
    ).not.toBeNull();
  });
});

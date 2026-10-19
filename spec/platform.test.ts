import type { Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { chromePath, DESKTOP, launch } from "./browser";
import { Person, probe, signedUp } from "./people";

// The platform under the app (HD audit, 19 Oct): what every response says
// about how a browser may treat it, a health check Fly can ask, what a photo
// carries out of someone's phone, and the two ways out --- logging out and
// deleting yourself.

const baseUrl = inject("baseUrl");

describe("security headers, on every kind of response", () => {
  // Invite, event and sign-in links are secrets in URLs, so no page may hand
  // its address to another site (Referer); no response may be sniffed into
  // something else, framed, or given the camera; and the CSP is the last line
  // if escaping ever slips.
  async function startGroup() {
    const ana = new Person(baseUrl, probe("Ana"));
    const res = await ana.post("/api/groups", { group: probe("Header crew"), name: ana.name, timezone: "Australia/Sydney" });
    return { ana, res, path: res.headers.get("location") ?? "" };
  }

  const expectHeaders = (res: Response, what: string) => {
    const h = res.headers;
    expect(h.get("referrer-policy"), `${what}: Referrer-Policy`).toBe("no-referrer");
    expect(h.get("x-content-type-options"), `${what}: nosniff`).toBe("nosniff");
    expect(h.get("x-frame-options"), `${what}: no framing`).toBe("DENY");
    expect(h.get("strict-transport-security"), `${what}: HSTS`).toMatch(/max-age=31536000/);
    const permissions = h.get("permissions-policy") ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
      expect(permissions, `${what}: ${feature} off`).toContain(`${feature}=()`);
    }
    const csp = h.get("content-security-policy") ?? "";
    for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"]) {
      expect(csp, `${what}: CSP ${directive}`).toContain(directive);
    }
    expect(csp, `${what}: no script from anywhere but here`).not.toMatch(/script-src[^;]*(https?:|\*)/);
  };

  it("on pages, a group page, a partial, an API redirect, the stream and an error", async () => {
    for (const path of ["/", "/welcome", "/readme/", "/me"]) {
      expectHeaders(await fetch(new URL(path, baseUrl)), path);
    }
    const { ana, res, path } = await startGroup();
    expectHeaders(res, "a form's 303");
    expectHeaders((await ana.get(path)).res, "a group page");
    expectHeaders((await ana.get("/partials/thread?kind=hangout&ref=0")).res, "a partial");
    // Not static files (/_astro/*, /favicon.svg): the Node adapter serves
    // those before middleware runs, and they're this site's own assets.
    expectHeaders(await fetch(new URL("/api/groups/nope/manage", baseUrl), { method: "POST", headers: { origin: baseUrl } }), "a refusal");

    const id = path.split("/").pop() ?? "";
    const abort = new AbortController();
    const live = await fetch(new URL(`/api/live?topics=group:${id}`, baseUrl), { headers: { cookie: ana.cookie }, signal: abort.signal });
    expect(live.status).toBe(200);
    expectHeaders(live, "the live stream");
    abort.abort();
  });
});

describe("a health check Fly can ask", () => {
  it("GET /api/health answers 200 ok once the database answers", async () => {
    const res = await fetch(new URL("/api/health", baseUrl));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("cache-control"), "never a cached answer").toMatch(/no-store/);
  });
});

describe.skipIf(!chromePath)("the CSP, in a real browser", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await launch();
  });
  afterAll(async () => {
    await browser?.close();
  });

  it("no page logs a violation, every tab and the live stream included", async () => {
    // A signed-in person with a group, a hangout and an event: every page a
    // marker opens, as it looks with something on it.
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();
    const violations: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(`${page.url()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => violations.push(`${page.url()}: ${e.message}`));

    await page.goto(`${baseUrl}/`);
    await page.fill('input[name="group"]', probe("CSP crew"));
    await page.fill('input[name="name"]', "Ana");
    await page.click('form[action="/api/groups"] button[type=submit]');
    await page.waitForURL(/\/g\//);
    const group = page.url().split("#")[0].split("?")[0];

    // the inline scripts ran: the landing form got the browser's timezone,
    // and the group page picked its tab before paint
    await page.goto(`${baseUrl}/welcome`);
    expect(await page.inputValue("#timezone"), "the inline timezone script ran").not.toBe("");

    await page.goto(`${group}?week=2030-01-07#week`);
    expect(await page.evaluate(() => document.documentElement.dataset.tab), "the inline tab script ran").toBe("week");
    await page.locator('label:has(input[value="2030-01-08T18"])').click();
    await page.waitForFunction(() => /Saved/.test(document.querySelector("#save-status")?.textContent ?? ""));
    for (const tab of ["best", "plans", "people", "week"]) {
      await page.click(`[data-tabs] a[data-tab="${tab}"]`);
      expect(await page.evaluate(() => document.documentElement.dataset.tab)).toBe(tab);
    }

    await page.goto(`${baseUrl}/events/new`);
    await page.fill('input[name="title"]', probe("CSP party"));
    await page.fill('input[name="date"]', "2030-02-01");
    await page.fill('input[name="start"]', "18:00");
    await page.fill('input[name="end"]', "20:00");
    await page.click('form[action="/api/events"] button[type=submit]');
    await page.waitForURL(/\/e\//);

    for (const path of ["/", "/welcome", "/readme/", "/me", "/calendar", "/friends", "/inbox", "/events", "/groups"]) {
      await page.goto(`${baseUrl}${path}`);
    }

    // live updates still arrive (EventSource is connect-src): Ben joins and
    // saves the same hour, and Ana's open page heats it with no reload
    await page.goto(`${group}?week=2030-01-07#week`);
    const ben = new Person(baseUrl, probe("Ben"));
    const id = group.split("/g/")[1];
    await ben.post(`/api/groups/${id}/join`, { name: ben.name });
    await page.waitForTimeout(300); // the stream is open before Ben saves
    await ben.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: ["2030-01-08T18"] });
    await page.waitForFunction(
      () => document.querySelector('input[value="2030-01-08T18"]')?.closest(".slot")?.getAttribute("data-heat") === "4",
      null,
      { timeout: 8000 },
    );

    await ctx.close();
    expect(violations).toEqual([]);
  }, 90_000);
});

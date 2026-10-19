import axe from "axe-core";
import { JSDOM } from "jsdom";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { chromePath, DESKTOP, launch, PHONE } from "./browser";
import { Person, probe, signedUp } from "./people";

// First impressions: what someone sees before they've done anything. The
// marker arrives with only the URL and starts at /readme/; a friend arrives
// from a link in a group chat, drawn as a preview card; anyone can mistype an
// address or open an event that's since been called off. Each of those is
// the app's first chance to say what it is, so each says it in the app's own
// clothes, and the front page says the idea: you mark your week before you
// see anyone else's.

const baseUrl = inject("baseUrl");
const WHEN = { date: "2030-02-12", start: "19:00", end: "21:00" };

const meta = (doc: Document, selector: string) => doc.querySelector(`meta[${selector}]`)?.getAttribute("content") ?? "";

/** A public event Ben has said he's going to, which Ana then cancels. */
async function cancelledEvent() {
  const ana = await signedUp(baseUrl, "Ana");
  const ben = await signedUp(baseUrl, "Ben");
  const res = await ana.post("/api/events", { title: probe("Doomed picnic"), visibility: "public", ...WHEN });
  const path = res.headers.get("location") ?? "";
  const ref = path.split("/").pop() ?? "";
  await ben.post(`/api/events/${ref}/rsvp`, { response: "going" });
  const cancel = () => ana.post(`/api/events/${ref}/cancel`);
  return { ana, ben, path, cancel };
}

describe("a page that doesn't exist", () => {
  it("answers 404 in the app's own clothes: the nav, one heading, a way home and to the readme", async () => {
    const { res, doc } = await new Person(baseUrl).get("/definitely-not-a-page");
    expect(res.status).toBe(404);
    expect(doc.querySelector('header.site nav[aria-label="Main"]'), "the app's own navigation").not.toBeNull();
    expect(doc.querySelectorAll("h1").length).toBe(1);
    const links = [...doc.querySelectorAll("main a")];
    expect(
      links.find((a) => a.getAttribute("href") === "/" && /back to hangout/i.test(a.textContent ?? "")),
      "a Back to Hangout button",
    ).toBeTruthy();
    expect(links.some((a) => a.getAttribute("href") === "/readme/"), "and a way to what Hangout is").toBe(true);
  });

  it("meets the quality floor every other page meets (the floor itself expects a 200)", async () => {
    const res = await fetch(new URL("/nothing/here/either", baseUrl));
    expect(res.status).toBe(404);
    const dom = new JSDOM(await res.text(), { url: new URL("/nothing/here/either", baseUrl).href, runScripts: "outside-only" });
    const doc = dom.window.document;
    expect(doc.documentElement.getAttribute("lang")).toBeTruthy();
    expect(doc.title).toMatch(/Hangout/);
    expect(doc.querySelector('meta[name="viewport"]')).not.toBeNull();
    const window = dom.window as unknown as { eval: (source: string) => void; axe: typeof axe };
    window.eval(axe.source);
    const results = await window.axe.run(doc, {
      rules: { "color-contrast": { enabled: false }, "link-in-text-block": { enabled: false } },
    });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }, 30_000);
});

describe("a cancelled event", () => {
  it("opened from its old link, is a not-found page in the app that says it may have been cancelled", async () => {
    const { ben, path, cancel } = await cancelledEvent();
    expect((await cancel()).status).toBe(303);
    for (const who of [ben, new Person(baseUrl)]) {
      const { res, doc } = await who.get(path);
      expect(res.status, "cancelling deletes it, so it can't be told from a link that never worked").toBe(404);
      expect(doc.querySelector('header.site nav[aria-label="Main"]')).not.toBeNull();
      expect(doc.querySelectorAll("h1").length).toBe(1);
      expect(doc.querySelector("main")?.textContent).toMatch(/cancelled/i);
      expect(doc.querySelector('main a[href="/events"]'), "a way on").not.toBeNull();
    }
  });

  it("re-read by a page that had it open, answers that it was cancelled, without an error status", async () => {
    const { ben, path, cancel } = await cancelledEvent();
    const live = async () => {
      const res = await fetch(new URL(path, baseUrl), { headers: { cookie: ben.cookie, "x-live": "1" } });
      return { status: res.status, doc: new JSDOM(await res.text()).window.document };
    };
    const before = await live();
    expect(before.doc.querySelector("#event-gone")?.hasAttribute("hidden"), "while it's on, the notice waits, hidden").toBe(true);
    await cancel();
    const after = await live();
    // a 404 to the live script's fetch is a red error in the console of
    // every guest who had the page open
    expect(after.status).toBe(200);
    expect(after.doc.querySelector("#event-gone")?.hasAttribute("hidden")).toBe(false);
    expect(after.doc.querySelector("#event-gone")?.textContent).toMatch(/was cancelled/i);
  });
});

describe("/readme/, where the marker starts", () => {
  it("opens with a try-it-in-60-seconds box before the README, and a Try it live button at the top and the bottom", async () => {
    const { doc } = await new Person(baseUrl).get("/readme/");
    const box = doc.querySelector("#try-it");
    expect(box, "a try-it box").not.toBeNull();
    expect(box?.textContent).toMatch(/60 seconds/);
    const steps = [...(box?.querySelectorAll("ol > li") ?? [])].map((li) => li.textContent ?? "");
    expect(steps.length).toBe(4);
    expect(steps[0]).toMatch(/start a group/i);
    expect(steps[1]).toMatch(/(second|other) (browser )?profile|private window|incognito/i);
    expect(steps[2]).toMatch(/blind|hidden|can't see/i);
    expect(steps[3]).toMatch(/calendar/i);

    const readmeTitle = doc.querySelector("article.readme h1");
    expect(readmeTitle, "README's own title").not.toBeNull();
    expect(
      box!.compareDocumentPosition(readmeTitle!) & doc.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING,
      "the box comes before the README",
    ).toBeTruthy();

    const tryLive = [...doc.querySelectorAll("main a")].filter((a) => /try it live/i.test(a.textContent ?? ""));
    expect(tryLive.length, "top and bottom").toBe(2);
    expect(tryLive[1].compareDocumentPosition(doc.querySelector("article.readme")!) & doc.defaultView!.Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    for (const a of tryLive) {
      const href = new URL(a.getAttribute("href") ?? "", baseUrl);
      expect(href.origin, "into this app, wherever it's deployed").toBe(new URL(baseUrl).origin);
      expect(href.pathname).not.toBe("/readme/");
      expect((await fetch(href)).status).toBe(200);
    }
  });
});

describe("the front page", () => {
  it("says the idea first: you mark your week before you see anyone else's", async () => {
    const { doc } = await new Person(baseUrl).get("/");
    const hero = `${doc.querySelector("#hero-title")?.textContent} ${doc.querySelector(".hero .lede")?.textContent}`;
    expect(hero).toMatch(/before (you see|seeing) anyone else['’]s/i);
    expect(doc.querySelectorAll(".hero .cta-row .button:not(.ghost)").length, "one primary call to action").toBe(1);
  });

  it("its demo is one member's view, kept blind until they've marked their own hours", async () => {
    const { doc } = await new Person(baseUrl).get("/");
    expect(doc.querySelector(".demo .vh")?.textContent, "described for a screen reader").toMatch(/hidden until/i);
    expect(doc.querySelector(".demo")?.textContent).toMatch(/until you mark yours/i);
  });

  it("the comparison's Hangout side says how it gets there, not just where", async () => {
    const { doc } = await new Person(baseUrl).get("/");
    const winner = doc.querySelector(".compare .winner");
    expect(winner?.querySelectorAll("li").length ?? 0).toBeGreaterThanOrEqual(3);
    expect(winner?.textContent).toMatch(/before/i);
  });
});

describe("the header", () => {
  it("holds only the nav, the inbox and you: the theme picker lives on /me", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    for (const who of [new Person(baseUrl), ana]) {
      for (const path of ["/", "/readme/", "/events"]) {
        const { doc } = await who.get(path);
        expect(doc.querySelector('header.site form[action="/api/theme"]'), `no theme picker in ${path}'s header`).toBeNull();
        expect(doc.querySelector("header.site details"), "nor any menu").toBeNull();
      }
      const { doc } = await who.get("/me");
      const look = doc.querySelector('main form[action="/api/theme"]');
      expect(look, "/me has the picker").not.toBeNull();
      expect(look?.querySelectorAll('button[name="theme"]').length).toBe(5);
      expect(look?.querySelectorAll('button[name="mode"]').length).toBe(3);
      expect(look?.querySelector<HTMLInputElement>('input[name="back"]')?.value).toBe("/me");
    }
    const { doc } = await ana.get("/");
    expect(doc.querySelector("header.site #bell"), "the inbox").not.toBeNull();
    expect(doc.querySelector('header.site a.me-link[href="/me"]'), "and you").not.toBeNull();
  });

  it("the main nav is Home, Groups, Calendar, Events and Friends; public Explore is inside Events", async () => {
    const { doc } = await new Person(baseUrl).get("/");
    const items = [...doc.querySelectorAll('nav[aria-label="Main"] a .nav-label')].map((l) => l.textContent?.trim());
    expect(items).toEqual(["Home", "Groups", "Calendar", "Events", "Friends"]);
    const events = (await new Person(baseUrl).get("/events")).doc;
    expect(events.querySelector('main a[href="#explore"]'), "Explore, one tap in from Events").not.toBeNull();
  });
});

describe("link previews and the browser's own chrome", () => {
  it("a shared page's card carries a large 1200×630 image", async () => {
    const { doc } = await new Person(baseUrl).get("/");
    const image = meta(doc, 'property="og:image"');
    expect(image, "an og:image").not.toBe("");
    expect(new URL(image).href, "absolute: a chat app fetches it from elsewhere").toBe(image);
    expect(meta(doc, 'name="twitter:card"')).toBe("summary_large_image");
    expect(meta(doc, 'property="og:image:alt"').length).toBeGreaterThan(10);
    const png = await fetch(new URL(new URL(image).pathname, baseUrl));
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    const bytes = new DataView(await png.arrayBuffer());
    expect([bytes.getUint32(16), bytes.getUint32(20)], "IHDR width and height").toEqual([1200, 630]);
  });

  it("a sign-in link's card stays generic: no image", async () => {
    const me = await signedUp(baseUrl, "Signer");
    const link = (await me.get("/me")).doc.querySelector<HTMLInputElement>("#sign-in-link")?.value ?? "";
    expect(link).toMatch(/\/me\/sign-in\//);
    const { doc } = await new Person(baseUrl).get(new URL(link).pathname);
    expect(doc.querySelector('meta[property^="og:image"]')).toBeNull();
    expect(meta(doc, 'name="twitter:card"')).toBe("summary");
  });

  it("the browser's bar takes the page's colour, light or dark, and follows a chosen mode", async () => {
    const colours = async (cookie = "") => {
      const res = await fetch(new URL("/", baseUrl), { headers: cookie ? { cookie } : {} });
      const doc = new JSDOM(await res.text()).window.document;
      return Object.fromEntries(
        [...doc.querySelectorAll('meta[name="theme-color"]')].map((m) => [m.getAttribute("media"), m.getAttribute("content")]),
      );
    };
    const system = await colours();
    const light = system["(prefers-color-scheme: light)"];
    const dark = system["(prefers-color-scheme: dark)"];
    expect(Object.keys(system).length).toBe(2);
    expect(light).toBeTruthy();
    expect(dark).toBeTruthy();
    expect(light).not.toBe(dark);
    expect(Object.values(await colours("mode=dark")), "dark whatever the system says").toEqual([dark, dark]);
    expect(Object.values(await colours("mode=light"))).toEqual([light, light]);
  });
});

// In real Chrome, at the two marking viewports.
let browser: Browser;
beforeAll(async () => {
  if (chromePath) browser = await launch();
});
afterAll(async () => {
  await browser?.close();
});

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

describe.skipIf(!chromePath)("first impressions, in a real browser", () => {
  it("a guest with an event open sees it was cancelled the moment it is, and nothing goes red in the console", async () => {
    const { ben, path, cancel } = await cancelledEvent();
    const ctx = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
    await ctx.addCookies([...ben.jar].map(([name, value]) => ({ name, value, url: baseUrl })));
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}${path}`);
    await page.waitForFunction(() => document.documentElement.dataset.live === "on");
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    expect(await page.locator("#rsvp").isVisible(), "the event, with its RSVP buttons").toBe(true);

    await cancel();
    await page.locator("#event-gone").getByText(/was cancelled/i).waitFor({ timeout: 5000 });
    expect(await page.locator("#rsvp").isVisible(), "no RSVP buttons for an event that's gone").toBe(false);
    expect(await page.locator("main h1:visible").count(), "one heading on show").toBe(1);
    expect(errors).toEqual([]);
    expect(await overflow(page)).toBe(0);
    await ctx.close();
  }, 30_000);

  it("/readme/ is a centred card of readable lines, and the header's Get started fits on one line", async () => {
    for (const [viewport, phone] of [[DESKTOP, false], [PHONE, true]] as const) {
      const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone });
      const page = await ctx.newPage();
      await page.goto(`${baseUrl}/readme/`);
      expect(await overflow(page)).toBe(0);
      const card = await page.locator("article.readme").boundingBox();
      if (!phone && card) {
        expect(Math.abs(card.x - (viewport.width - card.x - card.width)), "centred").toBeLessThan(2);
        expect(card.width, "about 720px wide").toBeGreaterThan(680);
        expect(card.width).toBeLessThan(760);
      }
      // the longest line of README text, in characters
      const longest = await page.evaluate(() => {
        let max = 0;
        for (const block of document.querySelectorAll("article.readme p, article.readme li")) {
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          const lines = new Map<number, number>();
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const range = document.createRange();
            for (let i = 0; i < (node.textContent ?? "").length; i++) {
              range.setStart(node, i);
              range.setEnd(node, i + 1);
              const top = Math.round(range.getBoundingClientRect().top);
              lines.set(top, (lines.get(top) ?? 0) + 1);
            }
          }
          max = Math.max(max, ...lines.values());
        }
        return max;
      });
      expect(longest, "no line longer than 75 characters").toBeLessThanOrEqual(75);
      const pill = await page.evaluate(() => {
        const el = document.querySelector("header.site .get-started");
        const range = document.createRange();
        range.selectNodeContents(el!);
        return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      });
      expect(pill, "Get started on one line").toBe(1);
      await ctx.close();
    }
  }, 60_000);

  it("the front page: the trust ticks never leave one dangling, and the demo rests when motion is reduced", async () => {
    for (const [viewport, phone] of [[DESKTOP, false], [PHONE, true]] as const) {
      const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone });
      const page = await ctx.newPage();
      await page.goto(`${baseUrl}/`);
      expect(await overflow(page)).toBe(0);
      const rows = await page.evaluate(() => {
        const tops = [...document.querySelectorAll(".reassure > *")].map((s) => Math.round(s.getBoundingClientRect().top));
        return [...new Set(tops)].map((t) => tops.filter((x) => x === t).length);
      });
      expect(rows.every((n) => n === rows[0]), `ticks per row ${rows.join("+")}: none left alone`).toBe(true);
      // moving: it opens blind, the others' hours hidden behind "your answer first"
      expect(await page.locator(".demo").getByText(/until you mark yours/i).isVisible()).toBe(true);
      await ctx.close();
    }
    const still = await browser.newContext({ viewport: DESKTOP, reducedMotion: "reduce" });
    const page = await still.newPage();
    await page.goto(`${baseUrl}/`);
    expect(
      await page.evaluate(() => document.querySelector(".demo")!.getAnimations({ subtree: true }).length),
      "nothing moves",
    ).toBe(0);
    // and it rests on the finished picture: answered, the group's week shown
    expect(await page.locator(".demo").getByText(/you['’]ve answered/i).isVisible()).toBe(true);
    expect(await page.locator(".demo").getByText(/until you mark yours/i).isVisible()).toBe(false);
    await still.close();
  }, 60_000);

  it("a page that doesn't exist holds up at both sizes, with its way home in view", async () => {
    for (const [viewport, phone] of [[DESKTOP, false], [PHONE, true]] as const) {
      const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone });
      const page = await ctx.newPage();
      const res = await page.goto(`${baseUrl}/nope`);
      expect(res?.status()).toBe(404);
      expect(await overflow(page)).toBe(0);
      expect(await page.getByRole("link", { name: /back to hangout/i }).isVisible()).toBe(true);
      await ctx.close();
    }
  }, 30_000);
});

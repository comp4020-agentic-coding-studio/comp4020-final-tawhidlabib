import type { Browser, BrowserContext, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { chromePath, DESKTOP, launch, PHONE } from "./browser";

// Holding up under use it wasn't designed for --- the HD band's own
// examples, in a real Chrome at the two marking viewports: the keyboard, a
// resize mid-interaction, a slow connection, a dropped one, two people at
// once. Each test is a person doing something the happy path didn't plan
// for, and the app still doing the right thing.

const baseUrl = inject("baseUrl");
const WEEK = "2030-01-07";

let browser: Browser;
beforeAll(async () => {
  if (chromePath) browser = await launch();
});
afterAll(async () => {
  await browser?.close();
});

async function person(viewport = DESKTOP, phone = false): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage();
  return { ctx, page };
}

/** Ana starts a group in one browser and Ben joins it in another. */
async function twoPeople(benViewport = DESKTOP, benPhone = false) {
  const ana = await person();
  await ana.page.goto(`${baseUrl}/`);
  await ana.page.fill('input[name="group"]', `Holds up ${Date.now()}`);
  await ana.page.fill('input[name="name"]', "Ana");
  await ana.page.click('form[action="/api/groups"] button[type=submit]');
  await ana.page.waitForURL(/\/g\//);
  const url = ana.page.url().split("#")[0].split("?")[0];
  const ben = await person(benViewport, benPhone);
  await ben.page.goto(url);
  await ben.page.fill('input[name="name"]', "Ben");
  await ben.page.click('form[action$="/join"] button[type=submit]');
  await ben.page.waitForURL(/\/g\//);
  return { ana, ben, url: `${url}?week=${WEEK}` };
}

const heat = (page: Page, slot: string) =>
  page.locator(`label:has(input[value="${slot}"])`).getAttribute("data-heat");

describe.skipIf(!chromePath)("holds up, in a real browser", () => {
  it("the grid works from the keyboard alone, and saves", async () => {
    const { ana } = await twoPeople();
    const { page } = ana;
    await page.goto(`${page.url().split("?")[0]}?week=${WEEK}#week`);
    await page.locator('input[name="slot"]').first().focus();
    expect(
      await page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>('input[name="slot"]')].filter((b) => b.tabIndex === 0).length),
      "the grid is one tab stop, not 112",
    ).toBe(1);
    await page.keyboard.press("ArrowRight");
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowDown");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("value"))).toBe("2030-01-08T18");
    await page.keyboard.press("Space");
    await page.keyboard.press("Shift+ArrowDown"); // ticks as it moves
    await page.waitForFunction(() => /Saved/.test(document.querySelector("#save-status")?.textContent ?? ""));
    await page.reload();
    expect(await page.locator('input[value="2030-01-08T18"]').isChecked()).toBe(true);
    expect(await page.locator('input[value="2030-01-08T19"]').isChecked()).toBe(true);
    await ana.ctx.close();
  }, 60_000);

  it("on a phone, nothing scrolls sideways, and the blind grid reveals the week the moment you answer", async () => {
    const { ana, ben, url } = await twoPeople(PHONE, true);
    await ana.page.goto(`${url}#week`);
    await ana.page.locator('label:has(input[value="2030-01-08T18"])').click();
    await ana.page.waitForFunction(() => /Saved/.test(document.querySelector("#save-status")?.textContent ?? ""));

    await ben.page.goto(`${url}#week`);
    expect(await ben.page.locator("#blind-note").isVisible(), "Ben answers first").toBe(true);
    expect(await heat(ben.page, "2030-01-08T18")).toBe("0");
    expect(await ben.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    await ben.page.locator('label:has(input[value="2030-01-08T20"])').tap();
    await ben.page.waitForFunction(() => !document.getElementById("blind-note"), null, { timeout: 8000 });
    await ben.page.waitForFunction(
      () => document.querySelector('input[value="2030-01-08T18"]')?.closest(".slot")?.getAttribute("data-heat") !== "0",
      null,
      { timeout: 8000 },
    );
    await ana.ctx.close();
    await ben.ctx.close();
  }, 60_000);

  it("a resize in the middle of marking hours loses nothing", async () => {
    const { ana } = await twoPeople();
    const { page } = ana;
    await page.goto(`${page.url().split("?")[0]}?week=${WEEK}#week`);
    await page.locator('label:has(input[value="2030-01-09T12"])').click();
    await page.setViewportSize(PHONE);
    await page.locator('label:has(input[value="2030-01-09T13"])').click();
    await page.setViewportSize(DESKTOP);
    await page.waitForFunction(() => /Saved/.test(document.querySelector("#save-status")?.textContent ?? ""));
    await page.reload();
    expect(await page.locator('input[value="2030-01-09T12"]').isChecked()).toBe(true);
    expect(await page.locator('input[value="2030-01-09T13"]').isChecked()).toBe(true);
    // and the tab indicator still sits under the chosen tab
    const [tab, bar] = await Promise.all([
      page.locator('.tabs a[data-tab="week"]').boundingBox(),
      page.locator(".tab-indicator").boundingBox(),
    ]);
    expect(Math.abs((tab?.x ?? 0) - (bar?.x ?? 99))).toBeLessThan(2);
    await ana.ctx.close();
  }, 60_000);

  it("on a slow connection a form is sent once, however many times it's pressed", async () => {
    const { ana } = await twoPeople();
    const { page } = ana;
    await page.goto(`${page.url().split("#")[0].split("?")[0]}#people`);
    // every rename takes three seconds to reach the server: a slow connection
    await page.route("**/manage", async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/manage")) posts.push(r.url());
    });
    await page.fill("#group-name", "Slow crew");
    // Press, then press again 300 ms later while the first is still on its
    // way, the way an impatient person taps a slow button. Done in the page:
    // presses in the same instant are merged by Chrome itself, so they'd
    // prove nothing (an earlier version of this test passed without the fix).
    const busy = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const button = document.querySelector<HTMLButtonElement>("form:has(#group-name) button[type=submit]");
          button?.click();
          setTimeout(() => {
            const disabled = !!button?.disabled;
            button?.click();
            resolve(disabled);
          }, 300);
        }),
    );
    expect(busy, "the button shows it's busy while the first press is on its way").toBe(true);
    await page.waitForTimeout(4500);
    expect(posts, "one rename, however many presses").toHaveLength(1);
    expect(await page.locator("h1").first().textContent()).toContain("Slow crew");
    await ana.ctx.close();
  }, 60_000);

  it("offline, it says so and holds your taps; back online, they save", async () => {
    const { ana } = await twoPeople();
    const { page, ctx } = ana;
    await page.goto(`${page.url().split("?")[0]}?week=${WEEK}#week`);
    await page.waitForFunction(() => document.documentElement.dataset.live === "on");
    await ctx.setOffline(true);
    await page.locator('label:has(input[value="2030-01-10T19"])').click();
    await page.waitForFunction(() => /Offline/.test(document.querySelector("#save-status")?.textContent ?? ""));
    await page.waitForFunction(() => !document.getElementById("conn")?.hidden, null, { timeout: 8000 });
    await ctx.setOffline(false);
    await page.waitForFunction(() => /Saved/.test(document.querySelector("#save-status")?.textContent ?? ""), null, {
      timeout: 15_000,
    });
    await page.reload();
    expect(await page.locator('input[value="2030-01-10T19"]').isChecked()).toBe(true);
    await ana.ctx.close();
  }, 60_000);

  it("two people marking at once both land, and each sees the other live", async () => {
    const { ana, ben, url } = await twoPeople(PHONE, true);
    await Promise.all([ana.page.goto(`${url}#week`), ben.page.goto(`${url}#week`)]);
    await Promise.all([
      ana.page.locator('label:has(input[value="2030-01-11T15"])').click(),
      ben.page.locator('label:has(input[value="2030-01-11T15"])').tap(),
    ]);
    for (const p of [ana.page, ben.page]) {
      await p.waitForFunction(
        () => document.querySelector('input[value="2030-01-11T15"]')?.closest(".slot")?.getAttribute("data-heat") === "4",
        null,
        { timeout: 8000 },
      );
    }
    await ana.ctx.close();
    await ben.ctx.close();
  }, 60_000);

  // Not a browser matter, but the same question: two people at once.
  it("two people proposing the same plan in the same second get one hangout, both in", async () => {
    const { ana, ben, url } = await twoPeople();
    const id = url.split("/g/")[1].split("?")[0];
    const propose = (page: Page) =>
      page.evaluate(
        (gid) =>
          fetch(`/api/groups/${gid}/hangouts`, {
            method: "POST",
            body: new URLSearchParams({ date: "2030-01-12", start: "18", end: "20", title: "Dinner" }),
          }),
        id,
      );
    await Promise.all([propose(ana.page), propose(ben.page)]);
    await ana.page.goto(`${url}#plans`);
    const cards = ana.page.locator('#plans-body article:has(.plan-title:text-is("Dinner"))');
    expect(await cards.count(), "one Dinner, not two").toBe(1);
    expect(await cards.first().locator(".going").textContent()).toMatch(/You[\s\S]*Ben|Ben[\s\S]*You/);
    await ana.ctx.close();
    await ben.ctx.close();
  }, 60_000);

  it("with JavaScript off, a group starts, a friend joins, and an hour saves by the plain form", async () => {
    const noJs = () => browser.newContext({ viewport: DESKTOP, javaScriptEnabled: false });
    const anaCtx = await noJs();
    const ana = await anaCtx.newPage();
    await ana.goto(`${baseUrl}/`);
    await ana.fill('input[name="group"]', `No script ${Date.now()}`);
    await ana.fill('input[name="name"]', "Ana");
    await ana.click('form[action="/api/groups"] button[type=submit]');
    await ana.waitForURL(/\/g\//);
    const url = ana.url().split("#")[0].split("?")[0];

    const benCtx = await noJs();
    const ben = await benCtx.newPage();
    await ben.goto(url);
    await ben.fill('input[name="name"]', "Ben");
    await ben.click('form[action$="/join"] button[type=submit]');
    await ben.waitForURL(/\/g\//);

    await ana.goto(`${url}?week=${WEEK}#week`);
    await ana.check('input[value="2030-01-08T18"]');
    await ana.getByRole("button", { name: "Save my hours" }).click();
    await ana.waitForLoadState("load");
    await ana.goto(`${url}?week=${WEEK}#week`);
    expect(await ana.locator('input[value="2030-01-08T18"]').isChecked(), "the hour came back after a reload").toBe(true);
    expect(await ana.locator('input[value="2030-01-08T19"]').isChecked(), "and only that hour").toBe(false);
    await anaCtx.close();
    await benCtx.close();
  }, 60_000);
});

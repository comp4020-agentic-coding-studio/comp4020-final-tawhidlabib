import { existsSync, readFileSync } from "node:fs";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { chromePath, DESKTOP, launch, PHONE, SMALLEST } from "./browser";
import { Person } from "./people";

// The landing page is the README. My tutor, Bill, agreed that Hangout's
// landing page can be my README submission, so its last section (#readme)
// carries the argument README.md makes, designed as part of the app, and
// README.md opens by saying so. Two copies of one argument drift apart the
// first time only one of them is edited, so this holds them together: every
// heading, every point, every source and its quoted words, and every
// enforced check in README.md has to be in the landing section, and each
// enforced check links the spec that holds it.
//
// And the landing page's sections below the hero fade in as they scroll into
// view (.reveal), in the built CSS a browser actually gets, never with
// motion reduced, and never in the README section, which is there to read.

const baseUrl = inject("baseUrl");
const README = readFileSync("README.md", "utf8");
const REPO = "https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/";
const DEPLOYED = "comp4020-final-tawhidlabib.fly.dev";

// Letters and digits only: markdown and HTML disagree about punctuation
// (smart quotes, dashes, entities) and whitespace, and none of that is content.
const normalise = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const squash = (s: string): string => s.replace(/\s+/g, " ").trim();
// markdown to its words: link targets, code ticks and emphasis dropped
const plain = (md: string): string => md.replace(/\]\([^)]*\)/g, "]").replace(/[`*[\]]/g, "");

/** `##` and `###` headings, in order, as text. */
const headings = (md: string): string[] => [...md.matchAll(/^ {0,3}#{2,3}\s+(.+?)\s*#*\s*$/gm)].map((m) => plain(m[1]));

/** The markdown under a `##`/`###` heading, up to the next heading of any level. */
function under(md: string, heading: RegExp): string {
  const lines = md.split(/\r?\n/);
  const at = lines.findIndex((l) => /^ {0,3}#{2,3}\s/.test(l) && heading.test(l));
  if (at < 0) return "";
  const end = lines.findIndex((l, i) => i > at && /^ {0,3}#{1,6}\s/.test(l));
  return lines.slice(at + 1, end < 0 ? undefined : end).join("\n");
}

/** A block's list items ("- " or "1. "), each with its wrapped lines joined. */
function items(block: string): string[] {
  const found: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    const start = line.match(/^ {0,3}(?:[-*]|\d+\.)\s+(.*)$/);
    if (start) found.push(start[1]);
    else if (/^\s{2,}\S/.test(line) && found.length) found[found.length - 1] += ` ${line.trim()}`;
    else if (!line.trim()) continue;
  }
  return found;
}

/** Every web link README.md cites, except the app's own address: sources, ADRs, judging. */
const cited = (md: string): string[] =>
  [...new Set([...md.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]))].filter((u) => new URL(u).host !== DEPLOYED);

/** Words quoted from a source: a "quote" within a few words after a source's link. */
const quotes = (md: string): string[] =>
  [...md.matchAll(/\]\((https?:\/\/[^)\s]+)\)[^"“\]]{0,40}?["“]([^"”]+)["”]/g)]
    .filter((m) => !new URL(m[1]).host.endsWith("github.com"))
    .map((m) => squash(m[2]));

async function landing() {
  const { res, doc } = await new Person(baseUrl).get("/welcome");
  expect(res.status).toBe(200);
  const section = doc.querySelector("#readme");
  expect(section, "/welcome has a README section, #readme").not.toBeNull();
  return { doc, section: section as Element, text: squash(section?.textContent ?? "") };
}

describe("README.md says the landing page is the README", () => {
  it("opens, straight after its title, by saying so, naming Bill, and linking to it", () => {
    const lines = README.split(/\r?\n/);
    const title = lines.findIndex((l) => /^#\s/.test(l));
    expect(lines[title], "README.md keeps its # Hangout title").toMatch(/^#\s+Hangout\s*$/);
    const next = lines.slice(title + 1).find((l) => l.trim() !== "") ?? "";
    expect(next, "the first thing after the title is the section that says it").toMatch(/^##\s.*landing page.*README/i);
    const opening = under(README, /landing page.*README/i);
    expect(plain(opening)).toMatch(/\bBill\b/);
    expect(plain(opening)).toMatch(/landing page/i);
    expect(opening).toContain(`(https://${DEPLOYED}/welcome#readme)`);
  });

  it("and /readme/, which publishes it, says the same with the same link", async () => {
    const { doc } = await new Person(baseUrl).get("/readme/");
    const article = doc.querySelector("article.readme");
    expect(article?.textContent).toMatch(/\bBill\b/);
    expect(article?.textContent).toMatch(/landing page is my README/i);
    const link = article?.querySelector(`a[href="https://${DEPLOYED}/welcome#readme"]`);
    expect(link, "a link to the landing page's README section").not.toBeNull();
  });
});

describe("the landing page's README section", () => {
  it("comes last, after Start a group, says it's the README and that Bill approved it, and leaves the hero the only h1", async () => {
    const { doc, section, text } = await landing();
    const start = doc.querySelector("#start");
    expect(start).not.toBeNull();
    expect(start!.compareDocumentPosition(section) & doc.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING, "after #start").toBeTruthy();
    expect(doc.querySelector("main > section:last-of-type"), "the last section on the page").toBe(section);
    expect(text).toMatch(/(this|the) landing page is my README/i);
    expect(text).toMatch(/\bBill\b/);
    expect(text).toMatch(/approved/i);
    expect(doc.querySelectorAll("h1").length).toBe(1);
    expect(section.querySelector("h1")).toBeNull();
    expect(section.querySelector("article.readme"), "designed in the page, not README.md's HTML dropped in").toBeNull();
  });

  it("has every heading of README.md as a heading, in the same order", async () => {
    const { section } = await landing();
    const expected = headings(README).filter((h) => !/landing page.*README/i.test(h));
    expect(expected.length, "README.md has headings to hold the section to").toBeGreaterThanOrEqual(5);
    const found = [...section.querySelectorAll("h2, h3")].map((h) => normalise(h.textContent ?? ""));
    let from = 0;
    for (const heading of expected) {
      const at = found.indexOf(normalise(heading), from);
      expect(at, `the README section has no heading "${heading}" (or has it out of order)`).not.toBe(-1);
      from = at + 1;
    }
  });

  it("links every source, ADR and docs/judging.md that README.md cites, and quotes each source's words exactly", async () => {
    const { section, text } = await landing();
    const links = cited(README);
    const sources = links.filter((u) => !new URL(u).host.endsWith("github.com"));
    expect(sources.length, "README.md cites its four sources (Zou, Reinecke, Sloan, Shirky)").toBeGreaterThanOrEqual(4);
    expect(links).toContain(`${REPO}docs/judging.md`);
    const hrefs = [...section.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    for (const url of links) expect(hrefs, `the README section doesn't link ${url}`).toContain(url);

    const words = quotes(README);
    expect(words.length, "README.md quotes Sloan and Shirky").toBeGreaterThanOrEqual(2);
    for (const q of words) expect(text, `the README section doesn't quote "${q}" word for word`).toContain(q);
  });

  it("makes each of README.md's points a card's heading, and lists every enforced check with a link to the spec that holds it", async () => {
    const { section } = await landing();
    const points = [...README.matchAll(/^ {0,3}(?:[-*]|\d+\.)\s+\*\*(.+?)\*\*/gm)].map((m) => m[1]);
    expect(points.length, "the seven points of what good means, and the three things not built").toBeGreaterThanOrEqual(10);
    const titles = [...section.querySelectorAll("h3")].map((h) => normalise(h.textContent ?? ""));
    for (const p of points) expect(titles, `no card is headed "${p}"`).toContain(normalise(p));

    const enforced = items(under(README, /enforced.*judged/i));
    expect(enforced.length, "README.md lists what spec/ enforces").toBeGreaterThanOrEqual(6);
    const rows = [...section.querySelectorAll("li")];
    for (const check of enforced) {
      const row = rows.find((li) => normalise(li.textContent ?? "").includes(normalise(plain(check))));
      expect(row, `the README section doesn't list "${plain(check)}"`).toBeTruthy();
      const specs = [...(row?.querySelectorAll(`a[href^="${REPO}spec/"]`) ?? [])].map((a) => a.getAttribute("href") ?? "");
      expect(specs.length, `"${plain(check)}" links no spec`).toBeGreaterThan(0);
      for (const href of specs) expect(existsSync(href.slice(REPO.length)), `${href} is not a file in this repo`).toBe(true);
    }
  });
});

describe("the blind grid's Why?", () => {
  it("still lands on README.md's heading at /readme/", async () => {
    const ana = new Person(baseUrl, "Ana");
    const made = await ana.post("/api/groups", { group: "Why crew", name: "Ana", timezone: "Australia/Sydney" });
    const { doc } = await ana.get(made.headers.get("location") ?? "/g/none");
    const why = doc.querySelector('#blind-note a[href="/readme/#the-blind-grid"]');
    expect(why, "an unanswered week explains itself").not.toBeNull();
    const readme = (await new Person(baseUrl).get("/readme/")).doc;
    const target = readme.querySelector("article.readme #the-blind-grid");
    expect(target?.tagName).toMatch(/^H[23]$/);
    expect(target?.textContent).toMatch(/the blind grid/i);
  });
});

// In real Chrome, against the built CSS.
let browser: Browser;
beforeAll(async () => {
  if (chromePath) browser = await launch();
});
afterAll(async () => {
  await browser?.close();
});

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Each .reveal section: its animation, whether it runs on a view timeline, and how opaque it is now. */
const reveals = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".reveal")].map((el) => ({
      id: el.id || el.getAttribute("aria-labelledby") || el.className,
      name: getComputedStyle(el).animationName,
      onScroll: el.getAnimations().some((a) => a.timeline?.constructor.name === "ViewTimeline"),
      opacity: Number(getComputedStyle(el).opacity),
    })),
  );

describe.skipIf(!chromePath)("the landing page in a real browser", () => {
  it("its sections below the hero fade in as they scroll into view", async () => {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/welcome`);
    const before = await reveals(page);
    expect(before.length, "How it works, Beat the group chat, Start a group").toBeGreaterThanOrEqual(3);
    for (const r of before) {
      expect(r.name, `${r.id}: computed animation-name (the minifier's "animation:linear both reveal view()" is dropped by Chrome)`).toBe("reveal");
      expect(r.onScroll, `${r.id}: driven by scrolling, not the clock`).toBe(true);
    }
    // Start a group sits below the fold: still faded until it's scrolled to
    expect(before.find((r) => r.id === "start")?.opacity, "below the fold, not yet in").toBeLessThan(0.5);
    await page.locator("#start").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#start")!).opacity === "1", null, { timeout: 3000 });
    await ctx.close();
  }, 30_000);

  it("with motion reduced, nothing fades: every section is there from the start", async () => {
    const ctx = await browser.newContext({ viewport: DESKTOP, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/welcome`);
    const still = await reveals(page);
    expect(still.length).toBeGreaterThanOrEqual(3);
    for (const r of still) {
      expect(r.name, r.id).toBe("none");
      expect(r.onScroll, r.id).toBe(false);
      expect(r.opacity, r.id).toBe(1);
    }
    await ctx.close();
  }, 30_000);

  it("the README section never hides its words, fits 1920, 390 and 320 wide, and every link in it takes focus from Tab", async () => {
    for (const [viewport, phone] of [
      [DESKTOP, false],
      [PHONE, true],
      [SMALLEST, true],
    ] as const) {
      const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone });
      const page = await ctx.newPage();
      await page.goto(`${baseUrl}/welcome`);
      const where = `${viewport.width}px`;
      expect(await page.locator("#readme").count(), where).toBe(1);
      expect(await page.locator("#readme.reveal, #readme .reveal").count(), "no scroll fade on text that's there to be read").toBe(0);
      expect(await sideways(page), `${where}: scrolls sideways`).toBe(0);

      // every element that holds words is drawn at full strength, before
      // it's scrolled to and after
      const faded = () =>
        page.evaluate(() =>
          [...document.querySelectorAll("#readme h2, #readme h3, #readme p, #readme li, #readme a")]
            .filter((el) => !el.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
            .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`),
        );
      expect(await faded(), `${where}: hidden or see-through before scrolling`).toEqual([]);
      await page.locator("#readme").evaluate((el) => el.scrollIntoView());
      await page.waitForTimeout(200);
      expect(await faded(), `${where}: hidden or see-through once in view`).toEqual([]);

      if (viewport !== SMALLEST) {
        const links = await page.locator("#readme a").count();
        expect(links, "the section links its sources and specs").toBeGreaterThan(10);
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          scrollTo(0, 0);
        });
        const reached = new Set<number>();
        for (let i = 0; i < 160 && reached.size < links; i++) {
          await page.keyboard.press("Tab");
          const at = await page.evaluate(() => [...document.querySelectorAll("#readme a")].indexOf(document.activeElement as Element));
          if (at >= 0) reached.add(at);
        }
        expect(reached.size, `${where}: links in the README section that Tab reached`).toBe(links);
      }
      await ctx.close();
    }
  }, 90_000);
});

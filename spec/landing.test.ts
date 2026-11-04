import { existsSync, readFileSync } from "node:fs";
import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { chromePath, DESKTOP, launch, PHONE, SMALLEST } from "./browser";
import { Person } from "./people";

// The landing page is the README. My tutor, Bill, agreed that Hangout's
// landing page can be my README, so after "Start a group" the page goes on
// telling its story in four sections of its own (#readme holds them), and
// README.md is the plain-text copy. They're written differently on purpose:
// the landing page as product sections a visitor wants to read, README.md
// under the headings the course expects. So this doesn't ask for the same
// headings in both. It holds the mapping between them instead:
//   - each of README.md's `##` headings (but the opening) begins with a link
//     to the landing section that stands in for it, /welcome#<id>, and that
//     id is a section on the landing page;
//   - every source README.md cites (Zou, Reinecke, Sloan, Shirky), and every
//     word quoted from one, is on the landing page too, link and words exact;
//   - every check README.md says spec/ enforces is listed on the landing page
//     with a link to the spec file that holds it, which exists;
//   - each copy points at the other: the landing page names Bill and links
//     /readme/; README.md names Bill, links /welcome#readme, and offers its
//     plain text as an alternative.
//
// And the landing page's sections below the hero fade in as they scroll into
// view (.reveal), in the built CSS a browser actually gets, never with motion
// reduced. In the README sections the visuals and entrances move, but no word
// is ever hidden from someone who has scrolled to it.

const baseUrl = inject("baseUrl");
const README = readFileSync("README.md", "utf8");
const REPO = "https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/";
const DEPLOYED = "comp4020-final-tawhidlabib.fly.dev";

const squash = (s: string): string => s.replace(/\s+/g, " ").trim();
// markdown to its words: link targets, code ticks and emphasis dropped
const plain = (md: string): string => md.replace(/\]\([^)]*\)/g, "]").replace(/[`*[\]]/g, "");
// letters and digits only: markdown and HTML disagree about punctuation
const normalise = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** The markdown under a heading (the line `heading` matches), up to the next heading of any level. */
function under(md: string, heading: RegExp, deep = false): string {
  const lines = md.split(/\r?\n/);
  const at = lines.findIndex((l) => heading.test(l));
  if (at < 0) return "";
  const stop = deep ? /^ {0,3}#{1,2}\s/ : /^ {0,3}#{1,6}\s/;
  const end = lines.findIndex((l, i) => i > at && stop.test(l));
  return lines.slice(at + 1, end < 0 ? undefined : end).join("\n");
}

/** README.md's `##` headings, each with the markdown under it (to the next `##`). */
const sections = (md: string) =>
  [...md.matchAll(/^ {0,3}##\s+(.+?)\s*#*\s*$/gm)].map((m) => ({ heading: plain(m[1]), body: under(md, new RegExp(`^ {0,3}##\\s+${m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), true) }));

/** A block's list items ("- " or "1. "), each with its wrapped lines joined. */
function items(block: string): string[] {
  const found: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    const start = line.match(/^ {0,3}(?:[-*]|\d+\.)\s+(.*)$/);
    if (start) found.push(start[1]);
    else if (/^\s{2,}\S/.test(line) && found.length) found[found.length - 1] += ` ${line.trim()}`;
  }
  return found;
}

/** The outside sources README.md cites: web links that are neither this app nor its own repo. */
const sources = (md: string): string[] =>
  [...new Set([...md.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]))].filter((u) => {
    const host = new URL(u).host;
    return host !== DEPLOYED && !host.endsWith("github.com");
  });

/** Words quoted from a source: a "quote" within a few words after a source's link. */
const quotes = (md: string): string[] =>
  [...md.matchAll(/\]\((https?:\/\/[^)\s]+)\)[^"“\]]{0,40}?["“]([^"”]+)["”]/g)]
    .filter((m) => !new URL(m[1]).host.endsWith("github.com"))
    .map((m) => squash(m[2]));

/** The first link under a heading, if it points at a landing section: its id. */
const landingAnchor = (body: string): string | undefined => {
  const first = body.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  return first.match(new RegExp(`\\]\\(https://${DEPLOYED.replace(/\./g, "\\.")}/welcome#([\\w-]+)\\)`))?.[1];
};

async function landing() {
  const { res, doc } = await new Person(baseUrl).get("/welcome");
  expect(res.status).toBe(200);
  const story = doc.querySelector("#readme");
  expect(story, "/welcome carries the README after Start a group, in #readme").not.toBeNull();
  return { doc, story: story as Element, text: squash(story?.textContent ?? "") };
}

describe("README.md, the plain-text copy", () => {
  it("opens, straight after # Hangout, by naming Bill, linking the landing page, and offering itself as the alternative", () => {
    const lines = README.split(/\r?\n/);
    const title = lines.findIndex((l) => /^#\s/.test(l));
    expect(lines[title], "README.md keeps its # Hangout title").toMatch(/^#\s+Hangout\s*$/);
    const opening = lines.slice(title + 1, lines.findIndex((l, i) => i > title && /^#{1,6}\s/.test(l))).join("\n");
    expect(opening.trim(), "a paragraph before the first heading").not.toBe("");
    expect(plain(opening)).toMatch(/\bBill\b/);
    expect(plain(opening)).toMatch(/landing page as my README/i);
    expect(opening).toContain(`(https://${DEPLOYED}/welcome#readme)`);
    expect(plain(opening), "and offers the plain text below instead").toMatch(/plain text below/i);
  });

  it("keeps the headings the course expects, in order, each opening with a link to the landing section that stands in for it", async () => {
    const found = sections(README);
    const expected = [/what good means/i, /what i read/i, /not to build/i, /enforced.*judged/i];
    let from = 0;
    for (const want of expected) {
      const at = found.findIndex((s, i) => i >= from && want.test(s.heading));
      expect(at, `README.md has no ## heading matching ${want} (or has it out of order)`).not.toBe(-1);
      from = at + 1;
    }
    const { doc } = await landing();
    for (const { heading, body } of found) {
      const id = landingAnchor(body);
      expect(id, `"## ${heading}" doesn't open with a link to https://${DEPLOYED}/welcome#<section>`).toBeTruthy();
      const target = doc.getElementById(id as string);
      expect(target, `"## ${heading}" links /welcome#${id}, which isn't on the landing page`).not.toBeNull();
      expect(target?.closest("#readme"), `/welcome#${id} is one of the README's sections`).not.toBeNull();
    }
  });

  it("and /readme/, which publishes it, says the same with the same links", async () => {
    const { doc } = await new Person(baseUrl).get("/readme/");
    const article = doc.querySelector("article.readme");
    expect(article?.textContent).toMatch(/\bBill\b/);
    expect(article?.querySelector(`a[href="https://${DEPLOYED}/welcome#readme"]`), "a link to the landing page").not.toBeNull();
    for (const { body } of sections(README)) {
      const id = landingAnchor(body);
      expect(article?.querySelector(`a[href="https://${DEPLOYED}/welcome#${id}"]`), `a link to /welcome#${id}`).not.toBeNull();
    }
  });
});

describe("the landing page's README sections", () => {
  it("come after Start a group, as their own landing sections, and leave the hero the only h1", async () => {
    const { doc, story } = await landing();
    const start = doc.querySelector("#start");
    expect(start).not.toBeNull();
    expect(start!.compareDocumentPosition(story) & doc.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING, "after #start").toBeTruthy();
    const parts = story.querySelectorAll(":scope > section[id]");
    expect(parts.length, "three or four sections, each with its own id").toBeGreaterThanOrEqual(3);
    for (const part of parts) expect(part.querySelector("h2"), `#${part.id} has its own heading`).not.toBeNull();
    expect(doc.querySelectorAll("h1").length).toBe(1);
    expect(story.querySelector("h1")).toBeNull();
    expect(story.querySelector("article.readme"), "designed in the page, not README.md's HTML dropped in").toBeNull();
  });

  it("name Bill and offer the plain text at /readme/, as a footnote, with no pill buttons", async () => {
    const { story, text } = await landing();
    expect(text).toMatch(/\bBill\b/);
    const plainText = [...story.querySelectorAll('a[href="/readme/"]')];
    expect(plainText.length, "a link to the plain-text README").toBeGreaterThan(0);
    expect(story.querySelectorAll(".pill, .toc").length, "no pills or contents pills").toBe(0);
  });

  it("link every source README.md cites, and quote each source's words exactly", async () => {
    const { story, text } = await landing();
    const links = sources(README);
    expect(links.length, "README.md cites its four sources (Zou, Reinecke, Sloan, Shirky)").toBeGreaterThanOrEqual(4);
    const hrefs = [...story.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    for (const url of links) expect(hrefs, `the landing page doesn't link ${url}`).toContain(url);
    const words = quotes(README);
    expect(words.length, "README.md quotes Sloan and Shirky").toBeGreaterThanOrEqual(2);
    for (const q of words) expect(text, `the landing page doesn't quote "${q}" word for word`).toContain(q);
  });

  it("list every check README.md says spec/ enforces, each linking the spec that holds it", async () => {
    const { story } = await landing();
    const enforced = items(under(README, /^ {0,3}##\s.*enforced.*judged/i));
    expect(enforced.length, "README.md lists what spec/ enforces").toBeGreaterThanOrEqual(6);
    const rows = [...story.querySelectorAll("li")];
    for (const check of enforced) {
      const row = rows.find((li) => normalise(li.textContent ?? "").includes(normalise(plain(check))));
      expect(row, `the landing page doesn't list "${plain(check)}"`).toBeTruthy();
      const specs = [...(row?.querySelectorAll(`a[href^="${REPO}spec/"]`) ?? [])].map((a) => a.getAttribute("href") ?? "");
      expect(specs.length, `"${plain(check)}" links no spec`).toBeGreaterThan(0);
      for (const href of specs) expect(existsSync(href.slice(REPO.length)), `${href} is not a file in this repo`).toBe(true);
    }
    expect(story.querySelector(`a[href="${REPO}docs/judging.md"]`), "the judged claims link how they're judged").not.toBeNull();
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

/** Words in #readme that aren't drawn at full strength: hidden, see-through, or under a fading ancestor. */
const faded = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#readme h2, #readme h3, #readme p, #readme li, #readme a, #readme blockquote")]
      .filter((el) => {
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return true;
        for (let n: Element | null = el; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 0.99) return true;
        return false;
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`),
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

  it("the README sections enter like the rest of the page, and with motion reduced nothing in them moves", async () => {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/welcome`);
    const inStory = (await reveals(page)).length - (await page.locator("main > .reveal").count());
    expect(await page.locator("#readme .reveal").count(), "scroll reveals in the README sections").toBeGreaterThanOrEqual(4);
    expect(inStory).toBeGreaterThanOrEqual(4);
    expect(await page.locator("#readme .lift").count(), "cards that lift on hover").toBeGreaterThanOrEqual(3);
    await ctx.close();

    const still = await browser.newContext({ viewport: DESKTOP, reducedMotion: "reduce" });
    const quiet = await still.newPage();
    await quiet.goto(`${baseUrl}/welcome`);
    await quiet.locator("#readme").evaluate((el) => el.scrollIntoView());
    for (const id of await quiet.locator("#readme > section[id]").evaluateAll((els) => els.map((e) => e.id))) {
      await quiet.locator(`#${id}`).evaluate((el) => el.scrollIntoView({ block: "center" }));
      await quiet.waitForTimeout(150);
    }
    const moving = await quiet.evaluate(() =>
      document
        .querySelector("#readme")!
        .getAnimations({ subtree: true })
        .map((a) => (a as CSSAnimation).animationName ?? "?"),
    );
    expect(moving, "nothing animates in the README sections with motion reduced").toEqual([]);
    expect(await faded(quiet), "and every word is there").toEqual([]);
    await still.close();
  }, 60_000);

  it("the README sections never hide words someone has scrolled to, fit 1920, 390 and 320 wide, and every link in them takes focus from Tab", async () => {
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
      expect(await sideways(page), `${where}: scrolls sideways`).toBe(0);

      // each block of words, scrolled to the middle of the screen, is drawn
      // at full strength: an entrance has finished by the time it's read
      const blocks = await page.locator("#readme h2, #readme h3, #readme p, #readme li, #readme blockquote").count();
      const dim: string[] = [];
      for (let i = 0; i < blocks; i++) {
        const el = page.locator("#readme h2, #readme h3, #readme p, #readme li, #readme blockquote").nth(i);
        await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(30);
        const state = await el.evaluate((n) => {
          if (!n.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return "hidden";
          for (let a: Element | null = n; a; a = a.parentElement) {
            const o = Number(getComputedStyle(a).opacity);
            if (o < 0.99) return `opacity ${o.toFixed(2)} on ${a.tagName.toLowerCase()}.${(a.className || "").toString().split(" ")[0]}`;
          }
          return "";
        });
        if (state) dim.push(`${(await el.textContent())?.trim().slice(0, 40)}: ${state}`);
      }
      expect(dim, `${where}: words not fully drawn once scrolled to the middle of the screen`).toEqual([]);
      expect(await sideways(page), `${where}: scrolls sideways after the reveals`).toBe(0);

      if (viewport !== SMALLEST) {
        const links = await page.locator("#readme a").count();
        expect(links, "the sections link their sources and specs").toBeGreaterThan(10);
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          scrollTo(0, 0);
        });
        const reached = new Set<number>();
        for (let i = 0; i < 200 && reached.size < links; i++) {
          await page.keyboard.press("Tab");
          const at = await page.evaluate(() => [...document.querySelectorAll("#readme a")].indexOf(document.activeElement as Element));
          if (at >= 0) reached.add(at);
        }
        expect(reached.size, `${where}: links in the README sections that Tab reached`).toBe(links);
      }
      await ctx.close();
    }
  }, 180_000);
});

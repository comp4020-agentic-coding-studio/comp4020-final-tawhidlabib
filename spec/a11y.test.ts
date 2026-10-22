import axe from "axe-core";
import type { Browser, BrowserContext, Page } from "playwright-core";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { currentWeekStart, weekDates } from "../src/lib/time.ts";
import { chromePath, cookiesFor, DESKTOP, launch, PHONE, SMALLEST } from "./browser";
import { befriend, friendCode, Person } from "./people";

// Accessibility in a real Chrome, which the jsdom floor (quality-floor) can't
// do: it has no layout and no computed colour, so contrast, what covers what,
// focus rings and reflow were never checked. This walks the app's pages at
// both marking viewports, light and dark, with motion reduced (a fade-in
// caught halfway reads as a contrast failure that no one ever sees):
//   - axe with colour contrast and target size on: zero violations;
//   - Tab through every page: focus is never under the bottom nav, the
//     sticky header, the tabs or the save bar, and every focus indicator
//     reads at 3:1 against what's behind it (WCAG 2.4.11, 1.4.11);
//   - at 320px nothing scrolls sideways (1.4.10).
// To keep it quick, the pages run in one theme (sunset), and the week grid,
// where the five themes differ most, runs in all five. Then a check for each
// thing the HD audit found that a sweep can't see: small targets, forced
// colours, the toast, the phone's sticky chrome, the best-time card and the
// today circle.
//
// axe in a real browser is not a clean bill of health on its own: with its
// defaults it read this app as 0 contrast violations while the heat counts
// were at 4.41:1. See runAxe for why, and for the options that make it look.

const baseUrl = inject("baseUrl");
const TZ = "Australia/Sydney";
const THEMES = ["sunset", "ocean", "forest", "grape", "rose"] as const;
const MODES = ["light", "dark"] as const;
type Mode = (typeof MODES)[number];
const FUTURE = "2030-01-07";

type Visit = { label: string; path: string; cookie?: string };
type World = {
  pages: Visit[];
  ana: Person;
  week: string;
  groupPath: string;
  party: string;
};

/** A small world over HTTP: Ana's group of four with hours this week (so the
 *  grid has heat and today) and in a future week (so there are best times and
 *  a plan), friends and a waiting request, a public event with Ana's poll, and
 *  a private one the group is invited to. Then every page, as who sees it. */
async function buildWorld(): Promise<World> {
  const ana = new Person(baseUrl, "Ana");
  const created = await ana.post("/api/groups", { group: "Board game night", name: "Ana", timezone: TZ });
  const groupPath = created.headers.get("location") ?? "/g/not-created";
  const id = groupPath.split("/").pop() ?? "";
  const [ben, cleo, dev] = ["Ben", "Cleo", "Dev"].map((n) => new Person(baseUrl, n));
  for (const p of [ben, cleo, dev]) await p.post(`/api/groups/${id}/join`, { name: p.name });
  await befriend(ana, ben);
  await dev.post("/api/friends", { code: await friendCode(ana) });

  // this week: all three others at day 0 18-20 (heat 4 to Ana), two at day 1
  // 18 (heat 3), one at day 2 19 (heat 2); Ana ticks two of the heat-4 hours
  // and one nobody else has
  const week = currentWeekStart(TZ);
  const d = weekDates(week);
  const at = (day: number, ...hours: number[]) => hours.map((h) => `${d[day]}T${String(h).padStart(2, "0")}`);
  const mark = (p: Person, w: string, slot: string[]) => p.post(`/api/groups/${id}/availability`, { week: w, slot, quiet: "1" });
  await mark(ben, week, [...at(0, 18, 19, 20), ...at(1, 18), ...at(2, 19)]);
  await mark(cleo, week, [...at(0, 18, 19, 20), ...at(1, 18)]);
  await mark(dev, week, at(0, 18, 19, 20));
  await mark(ana, week, [...at(0, 18, 19), ...at(4, 10)]);

  // a future week, so its hours are still recommendable: two best times
  const tue = ["18", "19", "20", "21"].map((h) => `2030-01-08T${h}`);
  const wed = ["12", "13", "14"].map((h) => `2030-01-09T${h}`);
  await mark(ana, FUTURE, [...tue, ...wed]);
  await mark(ben, FUTURE, [...tue, ...wed]);
  await mark(cleo, FUTURE, tue);
  await ana.post(`/api/groups/${id}/hangouts`, { date: "2030-01-10", start: "18", end: "20", title: "Dinner" });

  const when = { date: "2030-01-12", start: "12:00", end: "15:00", location: "Botanic Gardens" };
  const open = await ana.post("/api/events", { ...when, title: "Picnic in the park", visibility: "public" });
  const party = open.headers.get("location") ?? "/e/not-created";
  const partyRef = party.split("/").pop() ?? "";
  await ana.post("/api/polls", { kind: "event", ref: partyRef, question: "What should we bring?", option: ["Cake", "Fruit"] });
  const closed = await ana.post("/api/events", { ...when, title: "Surprise party", visibility: "private" });
  const secret = closed.headers.get("location") ?? "/e/not-created";
  await ana.post(`/api/events${secret.slice(2)}/invite`, { inviteGroup: id });

  const pages: Visit[] = [
    { label: "/welcome", path: "/welcome" },
    { label: "/readme/", path: "/readme/" },
    { label: "404", path: "/no-such-page" },
    { label: "/g/[id], invited", path: groupPath },
    { label: "/e/[id], stranger", path: party },
    { label: "/f/[code]", path: `/f/${await friendCode(ana)}` },
    { label: "home, signed in", path: "/", cookie: ana.cookie },
    { label: "/groups", path: "/groups", cookie: ana.cookie },
    { label: "/calendar", path: "/calendar?month=2030-01&day=2030-01-08", cookie: ana.cookie },
    { label: "/events", path: "/events", cookie: ben.cookie },
    { label: "/events/new", path: "/events/new", cookie: ana.cookie },
    { label: "/friends", path: "/friends", cookie: ana.cookie },
    { label: "/me, with Look", path: "/me", cookie: ana.cookie },
    { label: "/inbox", path: "/inbox", cookie: ana.cookie },
    { label: "/g/[id]#week", path: `${groupPath}#week`, cookie: ana.cookie },
    { label: "/g/[id]#best", path: `${groupPath}?week=${FUTURE}#best`, cookie: ana.cookie },
    { label: "/g/[id]#plans", path: `${groupPath}?week=${FUTURE}#plans`, cookie: ana.cookie },
    { label: "/g/[id]#people", path: `${groupPath}?week=${FUTURE}#people`, cookie: ana.cookie },
    { label: "/e/[id], host with a poll", path: party, cookie: ana.cookie },
  ];
  return { pages, ana, week, groupPath, party };
}

// ─── run inside the page (Playwright serialises these; keep them self-contained) ──

/** Where the focused element is: how much of it is hidden (off screen, or
 *  under something fixed or sticky that isn't its own container), and the
 *  contrast of its focus indicator against what's behind it. */
function focusReport() {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body || el === document.documentElement) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  // any CSS colour (oklab from color-mix, say) as sRGB bytes
  const rgba = (css: string): number[] => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const p = ctx.getImageData(0, 0, 1, 1).data;
    return [p[0], p[1], p[2], p[3] / 255];
  };
  const over = (top: number[], under: number[]) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = (c: number[]) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const colours = (s: string) => s.match(/(?:rgba?|oklab|oklch|lab|lch|color|hsla?)\([^()]*\)/g) ?? [];
  /** The colours a node's background could be: its own and its ancestors'
   *  layers composited down to the first opaque one (each gradient stop a
   *  candidate). */
  const behind = (node: Element | null): number[][] => {
    const layers: number[][][] = [];
    for (let n = node; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const own = rgba(cs.backgroundColor);
      // only the top layer: a gradient "border-box" layer under a surface
      // is the border, not what's behind the content
      const top = cs.backgroundImage.split(/,(?![^()]*\))/)[0];
      const stops = top.includes("gradient") ? colours(top).map(rgba) : [];
      if (stops.length) layers.push(stops);
      else if (own[3] > 0) layers.push([own]);
      if (own[3] >= 0.99 || (stops.length && stops.every((s) => s[3] >= 0.99))) break;
    }
    let cands = [[255, 255, 255, 1]];
    for (const layer of layers.reverse()) cands = layer.flatMap((c) => cands.map((u) => over(c, u)));
    return cands;
  };
  const describe = (n: Element) => {
    const text = (n.getAttribute("aria-label") ?? n.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
    const cls = typeof n.className === "string" && n.className ? `.${n.className.trim().split(/\s+/).join(".")}` : "";
    return `${n.tagName.toLowerCase()}${cls}${n.getAttribute("name") ? `[name=${n.getAttribute("name")}]` : ""}${text ? ` "${text}"` : ""}`;
  };

  // what a person sees: a visually hidden input is drawn by its label
  const own = el.getBoundingClientRect();
  const hiddenInput = getComputedStyle(el).opacity === "0" || own.width < 4 || own.height < 4;
  const box = (hiddenInput ? (el.closest("label") ?? el.parentElement) : el) as HTMLElement;
  const r = box.getBoundingClientRect();

  // things that stay put: found once per page
  const w = window as unknown as { __stuck?: Element[] };
  w.__stuck ??= [...document.querySelectorAll("body *")].filter((n) => /fixed|sticky/.test(getComputedStyle(n).position));
  const stuck = w.__stuck.filter((n) => n.isConnected && !n.contains(box) && !n.closest("[aria-hidden=true]") && n.getBoundingClientRect().height > 0);
  // a pointer-events: none overlay (a toast) never shows in a hit test
  const ghosts = stuck.filter((n) => getComputedStyle(n).pointerEvents === "none" && getComputedStyle(n).visibility !== "hidden");
  const N = 6;
  let hidden = 0;
  const by = new Set<string>();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = r.left + ((i + 0.5) / N) * r.width;
      const y = r.top + ((j + 0.5) / N) * r.height;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
        hidden++;
        by.add("off screen");
        continue;
      }
      const ghost = ghosts.find((g) => {
        const q = g.getBoundingClientRect();
        return x > q.left && x < q.right && y > q.top && y < q.bottom;
      });
      if (ghost) {
        hidden++;
        by.add(describe(ghost).split(" ")[0]);
        continue;
      }
      for (const s of document.elementsFromPoint(x, y)) {
        if (s === box || box.contains(s) || s.contains(box)) break;
        // the innermost: the bottom nav lives inside the sticky header
        const cover = stuck.filter((n) => n.contains(s)).sort((a, b) => (a.contains(b) ? 1 : -1))[0];
        if (cover) {
          hidden++;
          by.add(describe(cover).split(" ")[0]);
          break;
        }
      }
    }
  }

  // the focus indicator: an outline on the element (or the label drawing a
  // hidden input), else a ring box-shadow (0 0 0 Npx)
  let indicator: { colour: string; on: Element | null } | null = null;
  let auto = false;
  for (const c of hiddenInput ? [box] : [el]) {
    const cs = getComputedStyle(c);
    if (cs.outlineStyle === "auto") auto = true;
    if (cs.outlineStyle !== "none" && cs.outlineStyle !== "auto" && Number.parseFloat(cs.outlineWidth) >= 1) {
      indicator = { colour: cs.outlineColor, on: Number.parseFloat(cs.outlineOffset) >= 0 ? c.parentElement : c };
      break;
    }
    const rings = (cs.boxShadow === "none" ? [] : cs.boxShadow.split(/,(?![^()]*\))/))
      .map((s) => {
        const colour = colours(s)[0] ?? "";
        const [ox, oy, blur, spread] = (s.replace(colour, "").match(/-?[\d.]+px/g) ?? []).map(Number.parseFloat);
        return { colour, inset: s.includes("inset"), ox, oy, blur, spread };
      })
      .filter((s) => s.ox === 0 && s.oy === 0 && s.blur === 0 && s.spread > 0)
      .sort((a, b) => b.spread - a.spread);
    if (rings.length) {
      indicator = { colour: rings[0].colour, on: rings[0].inset ? c : c.parentElement };
      break;
    }
  }
  let contrast: number | null = auto ? 21 : null;
  let detail = auto ? "the browser's own ring" : "no indicator";
  if (indicator) {
    const ring = rgba(indicator.colour);
    const bgs = behind(indicator.on);
    contrast = Math.min(...bgs.map((bg) => ratio(over(ring, bg), bg)));
    detail = `ring ${indicator.colour} on rgb(${bgs[0].slice(0, 3).map(Math.round).join(", ")})`;
  }
  return {
    label: describe(el),
    hidden: hidden / (N * N),
    by: [...by].join(", "),
    contrast,
    detail,
  };
}

/** px the page scrolls sideways. */
const sideways = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;

// ─── the sweep ────────────────────────────────────────────────────────────

type Findings = Map<string, Set<string>>;
const note = (f: Findings, message: string, where: string) => f.set(message, (f.get(message) ?? new Set()).add(where));
const listed = (f: Findings) => [...f].map(([m, where]) => `${m}  [${[...where].join("; ")}]`);

const axeFound: Findings = new Map();
const covered: Findings = new Map();
const faint: Findings = new Map();
const reflow: Findings = new Map();

let browser: Browser;
let world: World;

async function contextFor(viewport: { width: number; height: number }, mode: Mode, extra = {}) {
  const ctx = await browser.newContext({
    viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    reducedMotion: "reduce",
    colorScheme: mode,
    ...extra,
  });
  return ctx;
}

async function open(ctx: BrowserContext, page: Page, visit: Visit, theme: string, mode: Mode) {
  await ctx.clearCookies();
  await ctx.addCookies([
    // not a flash an HTTP step left behind: its toast belongs to that step
    ...cookiesFor(baseUrl, visit.cookie).filter((c) => c.name !== "flash"),
    ...cookiesFor(baseUrl, `theme=${theme}; mode=${mode}`),
  ]);
  await page.goto(new URL(visit.path, baseUrl).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** axe, twice. First every rule, target size included. Then colour contrast
 *  again over ALL visible text: axe's defaults give up ("incomplete") on any
 *  text over a decorative pseudo-element (the header's blur, a button's
 *  sheen) and on one-character text (a heat count), and skip aria-hidden
 *  text (date tiles, heat counts), so in this app they pass almost
 *  everything unread. WCAG 1.4.3 covers every visible character. */
async function runAxe(page: Page, label: string, combo: string, contrastOnly = false) {
  await page.evaluate(axe.source);
  const violations = await page.evaluate(async (contrastOnly) => {
    const a = (window as unknown as { axe: typeof axe }).axe;
    const say = (r: axe.AxeResults) =>
      r.violations.flatMap((v) =>
        v.nodes.map((n) => {
          const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string };
          const numbers = data.contrastRatio ? ` ${data.fgColor} on ${data.bgColor} = ${data.contrastRatio}:1 (needs ${data.expectedContrastRatio})` : "";
          return `${v.id}: ${n.target.join(" ")}${numbers}`;
        }),
      );
    const all = contrastOnly
      ? []
      : say(await a.run(document, { resultTypes: ["violations"], rules: { "target-size": { enabled: true } } }));
    for (const n of document.querySelectorAll("[aria-hidden=true]")) n.removeAttribute("aria-hidden");
    const contrast = say(
      await a.run(document, {
        resultTypes: ["violations"],
        runOnly: { type: "rule", values: ["color-contrast"] },
        // merged into the check's own options (axe.configure would replace them)
        checks: { "color-contrast": { options: { ignorePseudo: true, ignoreLength: true } } },
      } as Parameters<typeof a.run>[1]),
    );
    return [...new Set([...all, ...contrast])];
  }, contrastOnly);
  for (const v of violations) note(axeFound, `${label} ${v}`, combo);
}

/** Tab through the page, then (on the week grid) arrow down and across it,
 *  reporting focus that's hidden or whose ring is faint. */
async function tabThrough(page: Page, label: string, combo: string) {
  const seen = new Set<string>();
  const check = async () => {
    const f = await page.evaluate(focusReport);
    if (!f) return null;
    if (f.hidden > 0) note(covered, `${label}: ${f.label} is ${Math.round(f.hidden * 100)}% hidden by ${f.by}`, combo);
    if (f.contrast === null || f.contrast < 3) {
      note(faint, `${label}: ${f.label} focus indicator ${f.contrast?.toFixed(2) ?? "missing"}:1 (${f.detail})`, combo);
    }
    return f;
  };
  for (let i = 0; i < 90; i++) {
    await page.keyboard.press("Tab");
    const f = await check();
    if (!f) break;
    const key = `${f.label}#${await page.evaluate(() => [...document.querySelectorAll("*")].indexOf(document.activeElement as Element))}`;
    if (seen.has(key)) break;
    seen.add(key);
  }
  if (label.endsWith("#week") && (await page.locator('input[name="slot"]').count())) {
    await page.locator('input[name="slot"][tabindex="0"]').focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("PageUp");
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press("ArrowDown");
      await check();
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("ArrowRight");
      await check();
    }
  }
}

async function pool<T>(jobs: (() => Promise<T>)[], size: number) {
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) await job();
    }),
  );
}

async function sweep() {
  const combos = [PHONE, DESKTOP].flatMap((viewport) => MODES.map((mode) => ({ viewport, mode })));
  const name = (v: { width: number }, mode: string, theme = "sunset") => `${v.width === PHONE.width ? "phone" : "desktop"} ${mode} ${theme}`;
  const jobs: (() => Promise<void>)[] = [];

  // every page, sunset, both viewports and modes: axe and the keyboard
  for (const { viewport, mode } of combos) {
    jobs.push(async () => {
      const ctx = await contextFor(viewport, mode);
      const page = await ctx.newPage();
      for (const visit of world.pages) {
        const combo = name(viewport, mode);
        await open(ctx, page, visit, "sunset", mode);
        await tabThrough(page, visit.label, combo);
        // axe last: its contrast pass takes aria-hidden off the page
        await open(ctx, page, visit, "sunset", mode);
        await runAxe(page, visit.label, combo);
      }
      await ctx.close();
    });
  }

  // the week grid in the other four themes, and /me (its links and Look card)
  // for contrast
  const grid = world.pages.find((p) => p.label === "/g/[id]#week") as Visit;
  const me = world.pages.find((p) => p.label === "/me, with Look") as Visit;
  for (const theme of THEMES.filter((t) => t !== "sunset")) {
    for (const { viewport, mode } of combos) {
      jobs.push(async () => {
        const ctx = await contextFor(viewport, mode);
        const page = await ctx.newPage();
        const combo = name(viewport, mode, theme);
        await open(ctx, page, grid, theme, mode);
        await tabThrough(page, grid.label, combo);
        await open(ctx, page, grid, theme, mode);
        await runAxe(page, grid.label, combo);
        if (viewport === DESKTOP) {
          await open(ctx, page, me, theme, mode);
          await runAxe(page, me.label, combo, true);
        }
        await ctx.close();
      });
    }
  }

  // reflow at 320px (layout, so one mode will do)
  jobs.push(async () => {
    const ctx = await contextFor(SMALLEST, "light");
    const page = await ctx.newPage();
    for (const visit of world.pages) {
      await open(ctx, page, visit, "sunset", "light");
      const over = await page.evaluate(sideways);
      if (over > 0) note(reflow, `${visit.label} scrolls ${over}px sideways`, "320px");
    }
    await ctx.close();
  });

  await pool(jobs, 5);
}

describe.skipIf(!chromePath)("accessible, in a real browser", () => {
  beforeAll(async () => {
    browser = await launch();
    world = await buildWorld();
    await sweep();
  }, 240_000);
  afterAll(async () => {
    await browser?.close();
  });

  it("axe, with colour contrast and target size on, finds nothing on any page, at either viewport, light or dark", () => {
    expect(listed(axeFound)).toEqual([]);
  });

  it("tabbing through, focus is never hidden under the bottom nav, the header, the tabs or the save bar", () => {
    expect(listed(covered)).toEqual([]);
  });

  it("every focus indicator reads at 3:1 against what's behind it, in all five themes on the week grid", () => {
    expect(listed(faint)).toEqual([]);
  });

  it("at 320px wide, no page scrolls sideways", () => {
    expect(listed(reflow)).toEqual([]);
  });

  it("the small controls are at least 24 by 24: Close poll, the poll's checkbox, the visibility radios", async () => {
    const ctx = await contextFor(PHONE, "light");
    const page = await ctx.newPage();
    const size = async (selector: string) => {
      const b = await page.locator(selector).first().boundingBox();
      return `${selector}: ${Math.round(b?.width ?? 0)}x${Math.round(b?.height ?? 0)}`;
    };
    await open(ctx, page, { label: "", path: world.party, cookie: world.ana.cookie }, "sunset", "light");
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const found = [
      await size('form[action$="/close"] button'),
      await size('input[name="multi"]'),
    ];
    await open(ctx, page, { label: "", path: "/events/new", cookie: world.ana.cookie }, "sunset", "light");
    found.push(await size('input[name="visibility"]'));
    const small = found.filter((s) => {
      const [w, h] = s.split(": ")[1].split("x").map(Number);
      return w < 24 || h < 24;
    });
    expect(small).toEqual([]);
    await ctx.close();
  }, 30_000);

  it("in forced colours, a ticked hour, a busy hour, the chosen tab and a focused field still look different", async () => {
    // Windows High Contrast and the like repaint every background in one
    // system colour, so a state shown only by a fill or a box-shadow
    // vanishes. Each state is shot twice in the same place, on and off, and
    // the shots must differ by a visible mark, not a stray pixel.
    const ctx = await contextFor(DESKTOP, "light", { forcedColors: "active" });
    const page = await ctx.newPage();
    await open(ctx, page, { label: "", path: `${world.groupPath}#week`, cookie: world.ana.cookie }, "sunset", "light");
    const shot = async (box: { x: number; y: number; width: number; height: number }) => {
      const png = await page.screenshot({ clip: box, animations: "disabled", caret: "hide" });
      return sharp(png).raw().toBuffer();
    };
    /** How many pixels differ between two shots of the same box. */
    const changed = (a: Buffer, b: Buffer) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++;
      return n;
    };
    const around = async (selector: string, pad = 0) => {
      const b = await page.locator(selector).first().boundingBox();
      if (!b) throw new Error(`nothing matches ${selector}`);
      return { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad };
    };
    const MARK = 30; // px: a ring or an outline, not anti-aliasing
    const differs: Record<string, number> = {};

    // an hour nobody else has, unticked then ticked (set in the page, so
    // nothing moves and no save happens)
    const slot = 'label.slot[data-heat="0"]:has(input:not(:checked))';
    const value = await page.locator(`${slot} input`).first().getAttribute("value");
    const cell = await around(`label.slot:has(input[value="${value}"])`);
    await page.mouse.move(0, 0);
    const off = await shot(cell);
    await page.evaluate((v) => {
      const box = document.querySelector<HTMLInputElement>(`input[value="${v}"]`) as HTMLInputElement;
      box.checked = true;
    }, value);
    differs["a ticked hour vs unticked"] = changed(off, await shot(cell));

    // an hour the whole group is free (heat 4) vs the same hour drawn at heat
    // 1: the number stays, so only the heat's own mark can tell them apart
    const busy = 'label.slot[data-heat="4"]:has(input:not(:checked))';
    if ((await page.locator(busy).count()) === 0) throw new Error("the world needs an unticked heat-4 hour");
    const hot = await around(busy);
    const hotOn = await shot(hot);
    await page.evaluate((sel) => {
      (document.querySelector(sel) as HTMLElement).dataset.heat = "1";
    }, busy);
    differs["the busiest hour vs a quiet one, same number"] = changed(hotOn, await shot(hot));

    // the same tab, chosen and not (chosen from inside the page, without
    // scrolling or focus, so the box and its pixels are the tab's alone)
    await page.mouse.move(0, 0);
    const tab = await around('.tabs a[data-tab="best"]');
    const unchosen = await shot(tab);
    await page.evaluate(() => {
      const y = scrollY;
      (document.querySelector('.tabs a[data-tab="best"]') as HTMLElement).click();
      (document.activeElement as HTMLElement | null)?.blur();
      scrollTo(0, y);
    });
    await page.waitForTimeout(100);
    differs["the chosen tab vs unchosen"] = changed(unchosen, await shot(await around('.tabs a[data-tab="best"]')));

    // a text field and a grid hour, focused and not (rings sit outside: shoot around)
    await open(ctx, page, { label: "", path: "/events/new", cookie: world.ana.cookie }, "sunset", "light");
    const field = await around('input[name="title"]', 8);
    const idle = await shot(field);
    await page.locator('input[name="title"]').focus();
    differs["a focused text field vs unfocused"] = changed(idle, await shot(field));

    const unmarked = Object.entries(differs)
      .filter(([, n]) => n < MARK)
      .map(([what, n]) => `${what}: ${n}px differ`);
    expect(unmarked).toEqual([]);
    await ctx.close();
  }, 30_000);

  it("the toast after an action never covers the page's heading or a primary button, and confetti never takes a tap", async () => {
    const overlaps: string[] = [];
    for (const viewport of [PHONE, DESKTOP]) {
      const ctx = await contextFor(viewport, "light");
      const page = await ctx.newPage();
      const covers = async (what: string) => {
        await page.waitForSelector(".toast");
        const hits = await page.evaluate(() => {
          const t = document.querySelector(".toast")?.getBoundingClientRect();
          if (!t) return [];
          const meet = (r: DOMRect) => r.width > 0 && r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top;
          return [...document.querySelectorAll<HTMLElement>("main h1, main .button:not(.ghost)")]
            .filter((n) => meet(n.getBoundingClientRect()))
            .map((n) => `${n.tagName.toLowerCase()} "${n.textContent?.replace(/\s+/g, " ").trim().slice(0, 30)}"`);
        });
        for (const h of hits) overlaps.push(`${viewport.width}px, ${what}: the toast covers ${h}`);
      };
      // a new group (the "created" toast, with confetti)
      await page.goto(`${baseUrl}/`);
      await page.fill('input[name="group"]', `Toast check ${Date.now()}`);
      await page.fill('input[name="name"]', "Ana");
      await page.click('form[action="/api/groups"] button[type=submit]');
      await page.waitForURL(/\/g\//);
      await covers("after starting a group");
      // a new event (the "hosted" toast), sent as the form would be
      await page.evaluate(() => {
        const form = Object.assign(document.createElement("form"), { method: "post", action: "/api/events" });
        const fields = { title: "Toast party", date: "2030-02-01", start: "18:00", end: "20:00", visibility: "public" };
        for (const [name, value] of Object.entries(fields)) form.append(Object.assign(document.createElement("input"), { name, value }));
        document.body.append(form);
        form.submit();
      });
      await page.waitForURL(/\/e\//);
      await covers("after hosting an event");
      await ctx.close();
    }
    expect(overlaps).toEqual([]);

    // confetti, with motion allowed: it falls over everything and every tap
    // goes through it
    const ctx = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/`);
    await page.fill('input[name="group"]', `Confetti check ${Date.now()}`);
    await page.fill('input[name="name"]', "Ana");
    await page.click('form[action="/api/groups"] button[type=submit]');
    await page.waitForSelector(".confetti");
    const taps = await page.evaluate(() => {
      const target = document.querySelector<HTMLElement>("main .button") as HTMLElement;
      const r = target.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        confetti: getComputedStyle(document.querySelector(".confetti") as Element).pointerEvents,
        reachesTheButton: !!hit && (hit === target || target.contains(hit)),
      };
    });
    expect(taps).toEqual({ confetti: "none", reachesTheButton: true });
    await ctx.close();
  }, 60_000);

  it("on a phone, the chrome that stays put while scrolling the grid (header, tabs, bottom nav) leaves the grid most of the screen", async () => {
    const ctx = await contextFor(PHONE, "light");
    const page = await ctx.newPage();
    await open(ctx, page, { label: "", path: `${world.groupPath}#week`, cookie: world.ana.cookie }, "sunset", "light");
    const chrome = await page.evaluate(async () => {
      const grid = document.querySelector("table.week") as HTMLElement;
      scrollTo(0, grid.getBoundingClientRect().top + scrollY + 300);
      await new Promise((r) => requestAnimationFrame(r));
      const top = Math.max(0, ...[...document.querySelectorAll("header.site, .tabs")].map((n) => n.getBoundingClientRect().bottom));
      const nav = document.querySelector(".main-nav")?.getBoundingClientRect();
      return Math.round(top + (nav ? innerHeight - nav.top : 0));
    });
    // it was ~196px (23% of an 844px screen); the audit's bar is well under that
    expect(chrome, "px of a 390x844 screen taken by chrome that doesn't scroll").toBeLessThanOrEqual(150);
    await ctx.close();
  }, 30_000);

  it("the best time stands out from the rest: a border at 3:1 against the page that the other cards don't have", async () => {
    const results: string[] = [];
    for (const mode of MODES) {
      const ctx = await contextFor(DESKTOP, mode);
      const page = await ctx.newPage();
      await open(ctx, page, { label: "", path: `${world.groupPath}?week=${FUTURE}#best`, cookie: world.ana.cookie }, "sunset", mode);
      const r = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
        const rgb = (css: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
        };
        const lum = (c: number[]) =>
          c
            .map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4))
            .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a: number[], b: number[]) => {
          const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
          return (hi + 0.05) / (lo + 0.05);
        };
        const page = rgb(getComputedStyle(document.body).backgroundColor);
        const [first, second] = [...document.querySelectorAll("#best .cards > .card")].map((c) => getComputedStyle(c));
        return {
          winner: first ? ratio(rgb(first.borderTopColor), page) : 0,
          width: first ? Number.parseFloat(first.borderTopWidth) : 0,
          runnerUp: second ? ratio(rgb(second.borderTopColor), page) : 99,
        };
      });
      if (r.winner < 3 || r.width < 2) results.push(`${mode}: the winner's border is ${r.winner.toFixed(2)}:1, ${r.width}px`);
      if (r.runnerUp >= 3) results.push(`${mode}: the runner-up's border is as strong (${r.runnerUp.toFixed(2)}:1)`);
      await ctx.close();
    }
    expect(results).toEqual([]);
  }, 30_000);

  it("the grid's today circle never touches its weekday", async () => {
    const overlaps: string[] = [];
    for (const viewport of [SMALLEST, PHONE, DESKTOP]) {
      const ctx = await contextFor(viewport, "light");
      const page = await ctx.newPage();
      await open(ctx, page, { label: "", path: `${world.groupPath}#week`, cookie: world.ana.cookie }, "sunset", "light");
      const o = await page.evaluate(() => {
        const th = document.querySelector('table.week thead th[aria-current="date"]');
        const circle = th?.querySelector("span")?.getBoundingClientRect();
        const text = th?.firstChild;
        if (!th || !circle || !text) return "no today column";
        const range = document.createRange();
        range.selectNodeContents(text);
        const word = range.getBoundingClientRect();
        // the gap between them, across or down (negative: they overlap); the
        // circle's glow reaches past its edge, so 3px is the least that reads
        const across = Math.max(circle.left - word.right, word.left - circle.right);
        const down = Math.max(circle.top - word.bottom, word.top - circle.bottom);
        const gap = Math.max(across, down);
        return gap < 3 ? `${gap.toFixed(1)}px between "${text.textContent}" and its circle` : "";
      });
      if (o) overlaps.push(`${viewport.width}px: ${o}`);
      await ctx.close();
    }
    expect(overlaps).toEqual([]);
  }, 30_000);
});

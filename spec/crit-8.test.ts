import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { wallTimeToUtc } from "../src/lib/time.ts";

// Crit 8 (It's alive!) — the checkable lines of its published spec:
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/08-its-alive/
//
//   "it's alive: a stranger can visit, do the core thing, and find their
//    trace still there when they come back"
//
// For Hangout the core thing is: start or join a friend group by its invite
// link, mark when you're free, and get from the overlap to a hangout that's
// on your calendar. These tests hold that flow over HTTP, against the running
// app, by what a person sees and submits --- not by how it's stored.
//
// Held elsewhere, not here: the *.fly.dev deploy (CI's deploy job checks it
// answers; network checks stay out of `pnpm check`), the repo going public
// (ship), PROCESS.md and reflections/crit-8.md (`pnpm check:evidence`), and
// publishing README.md at /readme/ (invariants.test.ts, readme-full.test.ts).

const baseUrl = inject("baseUrl");

// A fixed week well in the future, so nothing here depends on today's date
// or trips over "that time has already passed". January is AEDT (UTC+11).
const WEEK = "2030-01-07"; // a Monday
const TUESDAY = "2030-01-08";

const probe = (label: string) => `${label} ${process.hrtime.bigint()}`;

type Fields = Record<string, string | string[]>;

// Astro checks form POSTs carry a same-origin Origin header (CSRF
// protection); browsers send it automatically, a bare fetch doesn't.
function post(url: string, path: string, fields: Fields, cookie?: string) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of [value].flat()) body.append(key, v);
  }
  return fetch(new URL(path, url), {
    method: "POST",
    headers: { origin: url, ...(cookie ? { cookie } : {}) },
    body,
    redirect: "manual",
  });
}

async function page(url: string, path: string, cookie?: string) {
  const res = await fetch(new URL(path, url), { headers: cookie ? { cookie } : {} });
  return { res, doc: new JSDOM(await res.text()).window.document };
}

/** The member cookie a response sets, ready to send back. */
const cookieFrom = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("hg_")) ?? "";

async function startGroup(url: string) {
  const name = probe("Ana");
  const res = await post(url, "/api/groups", {
    group: probe("Friday crew"),
    name,
    timezone: "Australia/Sydney",
  });
  const path = res.headers.get("location") ?? "";
  return { res, path, id: path.split("/").pop() ?? "", name, cookie: cookieFrom(res) };
}

async function joinGroup(url: string, id: string) {
  const name = probe("Ben");
  const res = await post(url, `/api/groups/${id}/join`, { name });
  return { res, name, cookie: cookieFrom(res) };
}

const slots = (date: string, from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => `${date}T${String(from + i).padStart(2, "0")}`);

const saveFree = (url: string, id: string, cookie: string, free: string[]) =>
  post(url, `/api/groups/${id}/availability`, { week: WEEK, slot: free }, cookie);

const slotBox = (doc: Document, slot: string) =>
  doc.querySelector<HTMLInputElement>(`input[name="slot"][value="${slot}"]`);

describe("crit 8: a first version of what good means is in README.md", () => {
  const readme = readFileSync("README.md", "utf8");

  it("has replaced the template's README", () => {
    expect(readme, "README.md still carries the template's instructions").not.toContain(
      "<!-- TEMPLATE",
    );
    expect(readme, "README.md still has the template's heading").not.toMatch(
      /^#\s+Your app\s*$/m,
    );
  });
});

describe("crit 8: a stranger does the core thing, and finds their trace when they come back", () => {
  it("starting a group takes you to it and remembers who you are", async () => {
    const group = await startGroup(baseUrl);
    expect(group.res.status).toBe(303);
    expect(group.path).toMatch(/^\/g\/[A-Za-z0-9_-]{12}$/);
    expect(group.cookie, "starting a group should remember you with a cookie").not.toBe("");
  });

  it("a stranger with the invite link can join", async () => {
    const group = await startGroup(baseUrl);

    const invited = await page(baseUrl, group.path);
    expect(invited.res.status).toBe(200);
    expect(
      invited.doc.querySelector(`form[action="/api/groups/${group.id}/join"]`),
      "someone opening the invite link should be offered a way to join",
    ).not.toBeNull();

    const ben = await joinGroup(baseUrl, group.id);
    expect(ben.res.status).toBe(303);
    expect(ben.res.headers.get("location")).toBe(group.path);
    expect(ben.cookie).not.toBe("");
    expect(ben.cookie).not.toBe(group.cookie);
  });

  it("your availability is still there when you come back, and the group can see it", async () => {
    const group = await startGroup(baseUrl);
    const ben = await joinGroup(baseUrl, group.id);

    const saved = await saveFree(baseUrl, group.id, group.cookie, slots(TUESDAY, 18, 22));
    expect(saved.status).toBe(303);

    const ana = await page(baseUrl, `${group.path}?week=${WEEK}`, group.cookie);
    expect(slotBox(ana.doc, `${TUESDAY}T18`)?.checked, "Ana's own slot should come back ticked").toBe(
      true,
    );
    expect(slotBox(ana.doc, `${TUESDAY}T22`)?.checked).toBe(false);

    const bens = await page(baseUrl, `${group.path}?week=${WEEK}`, ben.cookie);
    const box = slotBox(bens.doc, `${TUESDAY}T18`);
    expect(box?.checked, "Ben never said he was free then").toBe(false);
    expect(
      box?.labels?.[0]?.textContent,
      "Ben's view of that hour should say Ana is free",
    ).toContain(group.name);
  });

  // A second GET proves nothing an in-memory array couldn't also pass. "Come
  // back" means the state outlived the server, so this starts a server of its
  // own, writes through it, kills it, and asks a cold one on the same database
  // file --- the difference between surviving a Fly redeploy and quietly
  // emptying every time a machine restarts.
  it("keeps it when the server is replaced", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "hangout-persist-")), "app.db");

    const first = await boot(dbPath);
    let group: Awaited<ReturnType<typeof startGroup>>;
    try {
      group = await startGroup(first.url);
      expect(group.res.status).toBe(303);
      expect((await saveFree(first.url, group.id, group.cookie, slots(TUESDAY, 9, 11))).status).toBe(
        303,
      );
    } finally {
      await first.stop();
    }

    const second = await boot(dbPath);
    try {
      const back = await page(second.url, `${group.path}?week=${WEEK}`, group.cookie);
      expect(back.res.status).toBe(200);
      expect(
        slotBox(back.doc, `${TUESDAY}T09`)?.checked,
        "the availability vanished when the server restarted — it's in memory, not the database",
      ).toBe(true);
    } finally {
      await second.stop();
    }
  }, 120_000);
});

describe("crit 8: from the overlap to a hangout on your calendar", () => {
  it("recommends the longest stretch the most people are free", async () => {
    const group = await startGroup(baseUrl);
    const ben = await joinGroup(baseUrl, group.id);
    // Ana 16–22, Ben 18–23: both of them 18–22. Ana alone at 16–18 and Ben
    // alone at 22–23 are longer-than-nothing but have fewer people.
    await saveFree(baseUrl, group.id, group.cookie, slots(TUESDAY, 16, 22));
    await saveFree(baseUrl, group.id, ben.cookie, slots(TUESDAY, 18, 23));

    const { doc } = await page(baseUrl, `${group.path}?week=${WEEK}`, ben.cookie);
    const top = doc.querySelector<HTMLFormElement>(`form[action="/api/groups/${group.id}/hangouts"]`);
    expect(top, "there should be a recommendation to propose").not.toBeNull();
    expect(top?.querySelector<HTMLInputElement>('[name="date"]')?.value).toBe(TUESDAY);
    expect(top?.querySelector<HTMLSelectElement>('[name="start"]')?.value).toBe("18");
    expect(top?.querySelector<HTMLSelectElement>('[name="end"]')?.value).toBe("22");
  });

  it("a proposal can be shortened, and saying you're in puts it on your calendar", async () => {
    const group = await startGroup(baseUrl);
    const ben = await joinGroup(baseUrl, group.id);
    const title = probe("Dumplings");

    const proposed = await post(
      baseUrl,
      `/api/groups/${group.id}/hangouts`,
      { date: TUESDAY, start: "19", end: "21", title },
      group.cookie,
    );
    expect(proposed.status).toBe(303);

    const before = await page(baseUrl, `${group.path}?week=${WEEK}`, ben.cookie);
    expect(before.doc.body.textContent).toContain(title);
    const rsvp = before.doc.querySelector<HTMLFormElement>('form[action^="/api/hangouts/"][action$="/rsvp"]');
    expect(rsvp, "Ben should be able to say whether he's in").not.toBeNull();

    const answered = await post(baseUrl, rsvp?.getAttribute("action") ?? "", { response: "in" }, ben.cookie);
    expect(answered.status).toBe(303);

    const after = await page(baseUrl, `${group.path}?week=${WEEK}`, ben.cookie);
    const google = after.doc.querySelector<HTMLAnchorElement>('a[href^="https://calendar.google.com/"]');
    expect(google, "once Ben's in, he should get an Add to Google Calendar link").not.toBeNull();
    // 19:00–21:00 on 8 Jan 2030 in Sydney (AEDT, UTC+11)
    expect(new URL(google?.href ?? "").searchParams.get("dates")).toBe(
      "20300108T080000Z/20300108T100000Z",
    );

    const icsLink = after.doc.querySelector<HTMLAnchorElement>('a[href$=".ics"]');
    expect(icsLink, "and a calendar file for every other calendar app").not.toBeNull();
    const ics = await fetch(new URL(icsLink?.getAttribute("href") ?? "", baseUrl), {
      headers: { cookie: ben.cookie },
    });
    expect(ics.status).toBe(200);
    expect(ics.headers.get("content-type")).toMatch(/^text\/calendar/);
    const body = await ics.text();
    expect(body).toContain("DTSTART:20300108T080000Z");
    expect(body).toContain("DTEND:20300108T100000Z");

    const stranger = await fetch(new URL(icsLink?.getAttribute("href") ?? "", baseUrl));
    expect(stranger.status, "a hangout's details are for its group only").toBe(403);
  });

  // The plausible-but-wrong shape CLAUDE.md warns about: an hour off is still
  // a well-formed time. Sydney moved to daylight saving on 4 Oct 2026.
  it("turns a Sydney wall-clock hour into the right instant either side of daylight saving", () => {
    expect(wallTimeToUtc("2026-10-03", 18, "Australia/Sydney").toISOString()).toBe(
      "2026-10-03T08:00:00.000Z",
    );
    expect(wallTimeToUtc("2026-10-05", 18, "Australia/Sydney").toISOString()).toBe(
      "2026-10-05T07:00:00.000Z",
    );
  });
});

/** Boot the built server on a free port against a given database file. CI's
 *  runner only builds inside Docker, so build here first if dist/ is missing. */
async function boot(databasePath: string): Promise<{ url: string; stop: () => Promise<void> }> {
  if (!existsSync("dist/server/entry.mjs")) execFileSync("pnpm", ["build"], { stdio: "ignore" });

  const port = await new Promise<number>((resolve) => {
    const s = createServer();
    s.listen(0, () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });

  const server = spawn("node", ["./dist/server/entry.mjs"], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATABASE_PATH: databasePath },
    stdio: "ignore",
  });

  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    if (attempt >= 50) {
      server.kill();
      throw new Error(`server did not come up at ${url}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    url,
    stop: () =>
      new Promise<void>((resolve) => {
        server.once("exit", () => resolve());
        server.kill();
      }),
  };
}

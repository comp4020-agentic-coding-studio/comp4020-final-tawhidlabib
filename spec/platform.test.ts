import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, statSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
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

describe("two ways to log out", () => {
  // Logging out used to delete this browser's cookies and change nothing on
  // the server, so a cookie copied off a shared laptop worked forever (HD
  // audit item 21). Now there are two buttons, each saying what it does:
  // this device only, or every other device (the token rotates, so every
  // copy of the old cookie and the old link stops working). The device you
  // press it on stays signed in with the new link: with no password, signing
  // out every device at once would lock you out of your own profile.
  const linkOf = async (p: Person) => /\/me\/sign-in\/([A-Za-z0-9_-]+)/.exec((await p.get("/me")).html)?.[1] ?? "";

  it("/me offers both, and says what each does", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const { doc } = await ana.get("/me");
    const forms = [...doc.querySelectorAll<HTMLFormElement>('form[action="/api/me/logout"]')];
    const scopes = forms.map((f) => f.querySelector<HTMLInputElement>('input[name="scope"]')?.value ?? "device");
    expect(scopes.sort()).toEqual(["device", "everywhere"]);
    for (const f of forms) expect(f.getAttribute("data-confirm"), "each asks first").toBeTruthy();
    const everywhere = forms.find((f) => f.querySelector('input[name="scope"][value="everywhere"]'));
    expect(everywhere?.textContent, "the button says it's every other device").toMatch(/everywhere else|other devices/i);
  });

  it("log out everywhere else: a copied cookie and the old link stop working; this device carries on", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const oldToken = await linkOf(ana);
    const oldCookie = ana.jar.get("hp") ?? "";
    expect(oldToken).not.toBe("");

    const res = await ana.post("/api/me/logout", { scope: "everywhere" });
    expect(res.status).toBe(303);

    const replay = new Person(baseUrl);
    replay.jar.set("hp", oldCookie);
    expect((await replay.get("/me")).html, "the old hp cookie no longer signs anyone in").not.toContain(ana.name);
    expect((await replay.get(`/me/sign-in/${oldToken}`)).res.status, "nor does the old link").toBe(404);

    const newToken = await linkOf(ana);
    expect(newToken, "this device is still Ana, with a new link").not.toBe("");
    expect(newToken).not.toBe(oldToken);
    const phone = new Person(baseUrl);
    await phone.post("/api/me/sign-in", { token: newToken });
    expect((await phone.get("/me")).html, "the new link signs in").toContain(ana.name);
  });

  it("log out on this device changes nothing on the server: the link still brings you back", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const token = await linkOf(ana);
    const copy = new Person(baseUrl);
    copy.jar.set("hp", ana.jar.get("hp") ?? "");
    expect((await ana.post("/api/me/logout", { scope: "device" })).status).toBe(303);
    expect(ana.jar.has("hp")).toBe(false);
    expect((await copy.get("/me")).html, "another device stays signed in").toContain(ana.name);
    expect((await new Person(baseUrl).get(`/me/sign-in/${token}`)).res.status, "the link still works").toBe(200);
  });
});

describe("shutting down", () => {
  // A deploy, or Fly stopping an idle machine, sends SIGTERM; Ctrl+C sends
  // SIGINT. The server should fold its write-ahead log back into the
  // database and close it, so the volume holds one whole file, and exit 0.
  // This boots its own server on a fresh database, writes through it, and
  // signals it.
  async function boot(databasePath: string) {
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
      if (attempt >= 75) {
        server.kill("SIGKILL");
        throw new Error(`server did not come up at ${url}`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
      server.once("exit", (code, signal) => resolve({ code, signal })),
    );
    return { url, server, exited };
  }

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    it(`on ${signal} it checkpoints the WAL, closes the database and exits 0`, async () => {
      const dbPath = join(mkdtempSync(join(tmpdir(), "hangout-shutdown-")), "app.db");
      const { url, server, exited } = await boot(dbPath);
      try {
        // a write, so the WAL has frames in it
        const res = await new Person(url, probe("Ana")).post("/api/groups", { group: probe("Shutdown crew"), name: "Ana", timezone: "Australia/Sydney" });
        expect(res.status).toBe(303);
        expect(statSync(`${dbPath}-wal`).size, "the write is in the WAL, not yet in the file").toBeGreaterThan(0);

        server.kill(signal);
        const { code } = await exited;
        expect(code, "a clean exit, not death by signal").toBe(0);
        const wal = existsSync(`${dbPath}-wal`) ? statSync(`${dbPath}-wal`).size : 0;
        expect(wal, "the WAL was checkpointed (TRUNCATE leaves it empty)").toBe(0);
      } finally {
        if (server.exitCode === null && server.signalCode === null) server.kill("SIGKILL");
      }
      // and the group is in the database file itself
      const db = new Database(dbPath, { readonly: true });
      try {
        expect((db.prepare("SELECT count(*) n FROM groups").get() as { n: number }).n).toBe(1);
      } finally {
        db.close();
      }
    }, 60_000);
  }
});

describe("a photo carries nothing out of the phone it came from", () => {
  // Phones write where a photo was taken (EXIF GPS) into the file. Avatars
  // are public and album photos go to a whole group, so a picture of
  // someone's lounge room could say where they live. A real 2x2 JPEG, with
  // an APP1 "Exif\0\0" segment spliced in after its start marker: a little-
  // endian TIFF header and a string standing in for the GPS block.
  const JPEG = Uint8Array.from(
    atob(
      "/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJgBh5//2Q==",
    ),
    (c) => c.charCodeAt(0),
  );
  const MARKER = "GPS-35.2809S-149.1300E-hangout-marker";
  function withExif(jpeg: Uint8Array): Uint8Array<ArrayBuffer> {
    const tiff = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]; // "II*\0", IFD at 8
    const body = [...new TextEncoder().encode("Exif\0\0"), ...tiff, ...new TextEncoder().encode(MARKER)];
    const length = body.length + 2;
    const app1 = [0xff, 0xe1, length >> 8, length & 0xff, ...body];
    return Uint8Array.from([...jpeg.slice(0, 2), ...app1, ...jpeg.slice(2)]);
  }
  const has = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text));

  it("the test photo really carries the marker, and is still a JPEG", () => {
    const photo = withExif(JPEG);
    expect(has(photo, MARKER)).toBe(true);
    expect([...photo.slice(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe1]);
  });

  it("an avatar is served without its EXIF", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const res = await ana.upload("/api/me/avatar", {}, [{ name: "me.jpg", type: "image/jpeg", bytes: withExif(JPEG) }]);
    expect(res.status).toBe(303);
    const src = (await ana.get("/me")).doc.querySelector(".me-link img")?.getAttribute("src") ?? "";
    expect(src).toMatch(/^\/avatars\/.+\.jpg$/);
    const served = await fetch(new URL(src, baseUrl));
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await served.arrayBuffer());
    expect([...bytes.slice(0, 3)], "still a JPEG").toEqual([0xff, 0xd8, 0xff]);
    expect(has(bytes, MARKER), "the GPS marker reached a stranger").toBe(false);
    expect(has(bytes, "Exif\0\0"), "no EXIF block at all").toBe(false);
  });

  it("an album photo is served without its EXIF", async () => {
    const ana = new Person(baseUrl, probe("Ana"));
    const made = await ana.post("/api/groups", { group: probe("Exif crew"), name: ana.name, timezone: "Australia/Sydney" });
    const path = made.headers.get("location") ?? "";
    const id = path.split("/").pop();
    const title = probe("Beach day");
    await ana.post(`/api/groups/${id}/hangouts`, { date: "2026-01-10", start: "10", end: "14", title });
    const card = () =>
      ana.get(path).then(({ doc }) => [...doc.querySelectorAll("#plans-body article")].find((a) => a.textContent?.includes(title)));
    const ref = (await card())?.querySelector("[data-thread]")?.getAttribute("data-thread")?.split(":")[1] ?? "";
    expect(ref, "the past hangout is on the group page").not.toBe("");

    const res = await ana.upload("/api/photos", { kind: "hangout", ref }, [{ name: "beach.jpg", type: "image/jpeg", bytes: withExif(JPEG) }]);
    expect(res.status).toBe(303);
    const src = (await card())?.querySelector(".album img")?.getAttribute("src") ?? "";
    expect(src).toMatch(/^\/media\/.+\.jpg$/);
    const served = await fetch(new URL(src, baseUrl), { headers: { cookie: ana.cookie } });
    expect(served.status).toBe(200);
    const bytes = new Uint8Array(await served.arrayBuffer());
    expect([...bytes.slice(0, 3)], "still a JPEG").toEqual([0xff, 0xd8, 0xff]);
    expect(has(bytes, MARKER), "the GPS marker reached the group").toBe(false);
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

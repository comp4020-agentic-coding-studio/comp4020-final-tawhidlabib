import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, inject, it } from "vitest";
import { Person, probe } from "./people";

// Crit 10 --- the logging outlives the crit. Every state change, and every
// refusal, leaves a row in the `activity` table (and a line on stdout, which
// Fly's `flyctl logs` captures). Tell two people apart, say what each did,
// and never write a secret.
//
// The test reads the app's own SQLite file, so it only runs where that file
// is this app's: the app is local and DATABASE_PATH (or the default) exists.
// In CI the app runs in Docker with its own /data, so those skip there.

const baseUrl = inject("baseUrl");
const dbPath = process.env.DATABASE_PATH ?? "./.data/app.db";
const appUrl = process.env.APP_URL ?? "http://localhost:8080";
const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(appUrl) && existsSync(dbPath);
const sqlite = it.skipIf(!local);

type Row = {
  id: number;
  at: string;
  actor_id: number | null;
  actor_label: string;
  action: string;
  target: string;
  outcome: string;
  detail: string | null;
};
const rows = (since: number): Row[] => {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return db.prepare("SELECT * FROM activity WHERE id > ? ORDER BY id").all(since) as Row[];
  } finally {
    db.close();
  }
};
const lastId = (): number => {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return (db.prepare("SELECT max(id) m FROM activity").get() as { m: number | null }).m ?? 0;
  } catch {
    return 0; // no table yet: the assertions below are what fail
  } finally {
    db.close();
  }
};

const WEEK = "2030-01-07"; // a Monday
async function groupOfTwo() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Log crew"), name: ana.name, timezone: "Australia/Sydney" });
  const id = (res.headers.get("location") ?? "").split("/").pop() ?? "";
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  return { ana, ben, id };
}

describe("crit 10: logs who did what", () => {
  sqlite("two people saving hours in one group leave two rows with different, named actors", async () => {
    const { ana, ben, id } = await groupOfTwo();
    const since = lastId();
    await ana.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T18`, `${WEEK}T19`] });
    await ben.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T20`] });
    const saved = rows(since).filter((r) => /hours/.test(r.action) && r.target.includes(id));
    expect(saved).toHaveLength(2);
    const [a, b] = saved;
    expect(a.actor_label).toContain(ana.name);
    expect(b.actor_label).toContain(ben.name);
    expect(a.actor_label).not.toBe(b.actor_label);
    expect(a.outcome).toBe("ok");
    expect(a.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  sqlite("a stranger saving hours in a group they are not in is logged as denied", async () => {
    const { id } = await groupOfTwo();
    const since = lastId();
    const stranger = new Person(baseUrl, probe("Stranger"));
    const res = await stranger.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T18`] });
    expect(res.status).toBe(403);
    const denied = rows(since).filter((r) => r.target.includes(id));
    expect(denied).toHaveLength(1);
    expect(denied[0].outcome).toMatch(/^denied/);
    expect(denied[0].actor_label).toBe("anon");
  });

  sqlite("no row holds a cookie token or a friend code", async () => {
    const { ana, ben, id } = await groupOfTwo();
    const since = lastId();
    await ana.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T18`] });
    await ben.post(`/api/groups/${id}/hangouts`, { date: WEEK, start: "18", end: "19" });
    await ana.post("/api/me/link");
    const code = /\/f\/([A-Za-z0-9_-]+)/.exec((await ben.get("/friends")).html)?.[1] ?? "";
    await ana.post("/api/friends", { code });
    const all = JSON.stringify(rows(since));
    expect(all.length).toBeGreaterThan(10);
    const secrets = [...ana.jar.values(), ...ben.jar.values(), code].filter((v) => v.length >= 8);
    expect(secrets.length).toBeGreaterThan(2);
    for (const s of secrets) expect(all, "a secret reached the activity log").not.toContain(s);
    expect(all).not.toMatch(/hp=|hg_/);
  });

  // Works everywhere: a refusal is still a refusal over HTTP, and the
  // logging must never turn one into a server error.
  it("logging never breaks a request: a refused save stays a 403, not a 500", async () => {
    const { id } = await groupOfTwo();
    const stranger = new Person(baseUrl, probe("Stranger"));
    const res = await stranger.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T18`] });
    expect(res.status).toBe(403);
  });
});

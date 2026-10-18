import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { describe, expect, inject, it } from "vitest";
import { befriend, Person, probe, signedUp } from "./people";

// Crit 10 --- the logging outlives the crit. Every state change, and every
// refusal, leaves a row in the `activity` table (and a line on stdout, which
// Fly's `flyctl logs` captures). Tell two people apart, say what each did,
// and never write a secret. A group's id is its invite link and an event's
// share id opens a private event, so those are secrets too: a row names a
// group or event by a short one-way tag and its name.
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
  const name = probe("Log crew");
  const res = await ana.post("/api/groups", { group: name, name: ana.name, timezone: "Australia/Sydney" });
  const id = (res.headers.get("location") ?? "").split("/").pop() ?? "";
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  return { ana, ben, id, name };
}

describe("crit 10: logs who did what", () => {
  sqlite("two people saving hours in one group leave two rows with different, named actors", async () => {
    const { ana, ben, id, name } = await groupOfTwo();
    const since = lastId();
    await ana.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T18`, `${WEEK}T19`] });
    await ben.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T20`] });
    const saved = rows(since).filter((r) => /hours/.test(r.action) && r.target.includes(name));
    expect(saved).toHaveLength(2);
    const [a, b] = saved;
    expect(a.actor_label).toContain(ana.name);
    expect(b.actor_label).toContain(ben.name);
    expect(a.actor_label).not.toBe(b.actor_label);
    expect(a.outcome).toBe("ok");
    expect(a.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  sqlite("a stranger saving hours in a group they are not in is logged as denied", async () => {
    const { id, name } = await groupOfTwo();
    const since = lastId();
    const stranger = new Person(baseUrl, probe("Stranger"));
    const res = await stranger.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T18`] });
    expect(res.status).toBe(403);
    const denied = rows(since).filter((r) => r.target.includes(name));
    expect(denied).toHaveLength(1);
    expect(denied[0].outcome).toMatch(/^denied/);
    expect(denied[0].actor_label).toBe("anon");
    // a refusal never reads as though it happened
    expect(denied[0].action).toBe("tried to save hours in");
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

  sqlite("no row holds a group's invite id or a private event's share id, and both are still named", async () => {
    const since = lastId();
    const { ana, ben, id, name } = await groupOfTwo();
    await ana.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T18`] });
    await ben.post(`/api/groups/${id}/hangouts`, { date: WEEK, start: "18", end: "19" });
    await new Person(baseUrl, probe("Stranger")).post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${WEEK}T18`] });

    const host = await signedUp(baseUrl, "Host");
    const guest = await signedUp(baseUrl, "Guest");
    await befriend(host, guest);
    const title = probe("Secret dinner");
    const made = await host.post("/api/events", { title, visibility: "private", date: "2030-01-10", start: "19:00", end: "22:00" });
    const shareId = (made.headers.get("location") ?? "").split("/").pop() ?? "";
    expect(shareId.length, "the event was made").toBeGreaterThanOrEqual(8);
    const nosy = await signedUp(baseUrl, "Nosy");
    expect((await nosy.post(`/api/events/${shareId}/rsvp`, { response: "going" })).status).toBe(403);
    await host.post(`/api/events/${shareId}/cancel`);

    const all = rows(since);
    const text = JSON.stringify(all);
    expect(text, "a group's invite id reached the activity log").not.toContain(id);
    expect(text, "a private event's share id reached the activity log").not.toContain(shareId);
    // still narratable: the same group reads the same way on every line
    const groupRows = all.filter((r) => r.target.includes(name));
    expect(groupRows.length).toBeGreaterThanOrEqual(4);
    expect(new Set(groupRows.map((r) => /group (\w+)/.exec(r.target)?.[1])).size, "one stable tag per group").toBe(1);
    const eventRows = all.filter((r) => r.target.includes(title));
    expect(eventRows.map((r) => `${r.action} → ${r.outcome}`)).toEqual([
      "created → ok",
      "tried to answer → denied (private event)",
      "cancelled → ok",
    ]);
  });

  sqlite("what someone types can't forge a log line, and a row says what happened, not what was asked", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    await befriend(ana, ben);
    const since = lastId();
    const benId = /p(\d+) /.exec(rows(0).findLast((r) => r.actor_label.includes(ben.name))?.actor_label ?? "")?.[1] ?? "";
    expect(benId).not.toBe("");
    const forged = `remove\n[activity] 2026-01-01T00:00:00Z p1 "Admin" deleted everything → ok`;
    await ana.post("/api/friends/respond", { person: benId, action: forged });
    for (const r of rows(since)) {
      for (const field of [r.actor_label, r.action, r.target, r.outcome, r.detail ?? ""]) {
        expect(field, "a newline in a row would start a forged line in flyctl logs").not.toMatch(/[\r\n]/);
        expect(field).not.toContain("deleted everything");
      }
    }
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

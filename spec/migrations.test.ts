import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

// Migrations must never lose data that's already on the volume.
//
// A migration that changes a column's foreign key rebuilds its table: create
// new, copy, DROP the old, rename. If foreign keys are on at that moment,
// dropping the old table cascade-deletes every row that points at it. In
// review, 0013 (hangouts.proposed_by → nullable) was found to do exactly
// that: drizzle runs migrations inside a transaction, where SQLite ignores
// the `PRAGMA foreign_keys=OFF` drizzle-kit writes, so every RSVP and
// comment on every plan would have gone at the next deploy. src/lib/db.ts
// now turns keys off before migrating.
//
// This test builds a database at the migration just before 0013, fills it
// with plans and the things that hang off them, then boots the real built
// server on it (which applies 0013 and later) and counts again.

const BEFORE = "0012_noisy_annihilus";

describe("migrations keep what's already there", () => {
  it("rebuilding hangouts keeps every RSVP, comment and reaction on every plan", async () => {
    if (!existsSync("dist/server/entry.mjs")) execFileSync("pnpm", ["build"], { stdio: "ignore" });

    // a database migrated only up to BEFORE, using drizzle's own migrator on a
    // copy of the journal cut at BEFORE
    const dir = mkdtempSync(join(tmpdir(), "hangout-migrate-"));
    const dbPath = join(dir, "app.db");
    const cut = join(dir, "drizzle");
    execFileSync("cp", ["-R", "drizzle", cut]);
    const journal = join(cut, "meta", "_journal.json");
    const meta = JSON.parse(readFileSync(journal, "utf8"));
    const at = meta.entries.findIndex((e: { tag: string }) => e.tag === BEFORE);
    expect(at, `${BEFORE} is in the journal`).toBeGreaterThan(-1);
    meta.entries = meta.entries.slice(0, at + 1);
    writeFileSync(journal, JSON.stringify(meta));
    execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import Database from "better-sqlite3";
         import { drizzle } from "drizzle-orm/better-sqlite3";
         import { migrate } from "drizzle-orm/better-sqlite3/migrator";
         const c = new Database(${JSON.stringify(dbPath)});
         migrate(drizzle(c), { migrationsFolder: ${JSON.stringify(cut)} });
         c.close();`,
      ],
      { stdio: "inherit" },
    );

    // plans with things hanging off them, as real data would have
    const seed = new Database(dbPath);
    seed.exec(`
      INSERT INTO groups (id, name, timezone, admin_id) VALUES ('migrategroup1', 'Migrate', 'Australia/Sydney', 1);
      INSERT INTO people (id, name, token, friend_code, timezone) VALUES
        (9001, 'Ana', 'tok-ana-xxxxxxxxxxxxxxxxxxxx', 'fc-ana-xx', 'Australia/Sydney'),
        (9002, 'Ben', 'tok-ben-xxxxxxxxxxxxxxxxxxxx', 'fc-ben-xx', 'Australia/Sydney');
      INSERT INTO members (id, group_id, name, name_key, token, person_id) VALUES
        (8001, 'migrategroup1', 'Ana', 'ana', 'mtok-ana-xxxxxxxxxxxxxxx', 9001),
        (8002, 'migrategroup1', 'Ben', 'ben', 'mtok-ben-xxxxxxxxxxxxxxx', 9002);
      INSERT INTO hangouts (id, group_id, date, start_hour, end_hour, title, proposed_by) VALUES
        (7001, 'migrategroup1', '2030-01-08', 18, 20, 'Walk', 8001),
        (7002, 'migrategroup1', '2030-01-09', 18, 20, 'Tea', 8002);
      INSERT INTO rsvps (hangout_id, member_id, response) VALUES (7001, 8001, 'in'), (7001, 8002, 'in'), (7002, 8002, 'in');
      INSERT INTO comments (hangout_id, author_id, body) VALUES (7001, 9002, 'see you'), (7002, 9001, 'yum');
      INSERT INTO reactions (hangout_id, person_id, emoji) VALUES (7001, 9001, '🎉');
    `);
    const count = (db: Database.Database) => ({
      hangouts: (db.prepare("SELECT count(*) n FROM hangouts").get() as { n: number }).n,
      rsvps: (db.prepare("SELECT count(*) n FROM rsvps").get() as { n: number }).n,
      comments: (db.prepare("SELECT count(*) n FROM comments").get() as { n: number }).n,
      reactions: (db.prepare("SELECT count(*) n FROM reactions").get() as { n: number }).n,
    });
    const before = count(seed);
    seed.close();
    copyFileSync(dbPath, `${dbPath}.before`);

    // boot the real server on it: that applies the remaining migrations
    const server = await boot(dbPath);
    await server.stop();

    const after = new Database(dbPath, { readonly: true });
    const now = count(after);
    const proposers = after.prepare("SELECT proposed_by FROM hangouts ORDER BY id").all();
    after.close();
    expect(now, "nothing that hangs off a plan was lost").toEqual(before);
    expect(proposers, "and who proposed each plan is kept").toEqual([{ proposed_by: 8001 }, { proposed_by: 8002 }]);
  }, 120_000);
});

async function boot(databasePath: string): Promise<{ stop: () => Promise<void> }> {
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
      server.kill();
      throw new Error(`server did not come up at ${url} (did a migration refuse to start?)`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { stop: () => new Promise<void>((resolve) => (server.once("exit", () => resolve()), server.kill())) };
}

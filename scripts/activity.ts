// Who did what, from the activity table: the same one-line format the app
// prints to stdout (and Fly keeps in `flyctl logs`), but read back from the
// database, so it's still there after a restart or a redeploy.
//
//   node scripts/activity.ts                      # last 50, the local database
//   node scripts/activity.ts --last 200
//   node scripts/activity.ts /data/app.db --last 20
//   flyctl ssh console -C "node scripts/activity.ts /data/app.db --last 30"   # production
//
// It only reads. Rows never hold a token, friend code or message body.

import Database from "better-sqlite3";

const args = process.argv.slice(2);
const lastAt = args.indexOf("--last");
const last = lastAt >= 0 ? Number(args[lastAt + 1]) : 50;
if (!Number.isInteger(last) || last < 1) {
  console.error("usage: node scripts/activity.ts [path-to-db] [--last N]");
  process.exit(2);
}
const positional = args.filter((a, i) => !a.startsWith("--") && i !== lastAt + 1);
const path = positional[0] ?? process.env.DATABASE_PATH ?? "./.data/app.db";

const db = new Database(path, { readonly: true, fileMustExist: true });
const rows = db
  .prepare(
    `SELECT at, actor_label, action, target, outcome, detail FROM (
       SELECT * FROM activity ORDER BY id DESC LIMIT ?
     ) ORDER BY id`,
  )
  .all(last) as { at: string; actor_label: string; action: string; target: string; outcome: string; detail: string | null }[];

for (const r of rows) {
  console.log(`[activity] ${r.at} ${r.actor_label} ${r.action} ${r.target} → ${r.outcome}${r.detail ? ` (${r.detail})` : ""}`);
}
if (rows.length === 0) console.log(`(no activity in ${path})`);

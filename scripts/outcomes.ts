// Did Hangout get groups from "we should hang out" to a plan? Reads the
// database (pass its path, or it uses DATABASE_PATH / the local default)
// and prints, for every group and overall: how many answered the week, how
// long from the group starting to its first plan, and how many said they're
// in. No names, nothing that identifies anyone --- counts and durations
// only, so the output can go straight into the README's "how I judged it".
//
//   node scripts/outcomes.ts                 # the local database
//   flyctl ssh console -C "node scripts/outcomes.ts /data/app.db"   # production
//
// It only reads.

import Database from "better-sqlite3";

const path = process.argv[2] ?? process.env.DATABASE_PATH ?? "./.data/app.db";
const db = new Database(path, { readonly: true, fileMustExist: true });

type Row = Record<string, number | string | null>;
const all = (sql: string, ...args: unknown[]) => db.prepare(sql).all(...args) as Row[];
const one = (sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) as Row;

const minutes = (a: string, b: string) => (Date.parse(`${b.replace(" ", "T")}Z`) - Date.parse(`${a.replace(" ", "T")}Z`)) / 60_000;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};
const fmt = (m: number | null) => (m === null ? "—" : m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);

const groups = all(`SELECT id, created_at FROM groups WHERE archived_at IS NULL OR archived_at IS NOT NULL`);
const toPlan: number[] = [];
let withPlan = 0;
let withThree = 0;
const sizes: number[] = [];
const answerRates: number[] = [];
const inRates: number[] = [];

for (const g of groups) {
  const members = Number(one(`SELECT count(*) n FROM members WHERE group_id = ?`, g.id).n);
  if (members < 2) continue; // a group of one hasn't been tried yet
  sizes.push(members);
  if (members >= 3) withThree++;
  const answered = Number(
    one(
      `SELECT count(DISTINCT m.id) n FROM members m
       WHERE m.group_id = ? AND (EXISTS (SELECT 1 FROM week_answers w WHERE w.member_id = m.id)
                              OR EXISTS (SELECT 1 FROM availability a WHERE a.member_id = m.id))`,
      g.id,
    ).n,
  );
  answerRates.push(answered / members);
  const first = one(`SELECT id, created_at FROM hangouts WHERE group_id = ? ORDER BY id LIMIT 1`, g.id);
  if (first) {
    withPlan++;
    toPlan.push(minutes(String(g.created_at), String(first.created_at)));
    const ins = Number(one(`SELECT count(*) n FROM rsvps WHERE hangout_id = ? AND response = 'in'`, first.id).n);
    inRates.push(ins / members);
  }
}

const tried = sizes.length;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

console.log(`Hangout outcomes (${path})`);
console.log(`groups tried (2+ members):        ${tried}  (median size ${median(sizes) ?? "—"}, ${withThree} with 3+)`);
console.log(`members who answered a week:      ${tried ? pct(avg(answerRates)) : "—"} on average`);
console.log(`groups that reached a plan:       ${withPlan} of ${tried}${tried ? ` (${pct(withPlan / tried)})` : ""}`);
console.log(`start → first plan:               median ${fmt(median(toPlan))}`);
console.log(`of a group, "I'm in" to its plan: ${inRates.length ? pct(avg(inRates)) : "—"} on average`);

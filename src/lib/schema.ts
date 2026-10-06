import { sql } from "drizzle-orm";
import { int, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`);

/** A friend group. Its id is also the invite secret: anyone with the link
 *  can join, which is the whole of the access model. */
export const groups = sqliteTable("groups", {
  id: text().primaryKey(),
  name: text().notNull(),
  /** IANA zone the group's hours are wall-clock times in. */
  timezone: text().notNull(),
  createdAt: createdAt(),
});

/** A person, as one group knows them: a name and the cookie secret that
 *  remembers them. The same human in two groups is two members. */
export const members = sqliteTable(
  "members",
  {
    id: int().primaryKey({ autoIncrement: true }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** Lowercased, trimmed name: "Ana" and "ana " are the same person here. */
    nameKey: text("name_key").notNull(),
    token: text().notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("members_group_name").on(t.groupId, t.nameKey)],
);

/** One free hour for one member: a concrete date, not a weekday, because
 *  people say when they're free *this* week. */
export const availability = sqliteTable(
  "availability",
  {
    memberId: int("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD, in the group's timezone. */
    date: text().notNull(),
    /** Whole hour on a 24h clock; the slot runs hour to hour + 1. */
    hour: int().notNull(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.date, t.hour] })],
);

/** A proposed time to meet. Pinned once proposed, so it doesn't drift when
 *  someone changes their availability afterwards. */
export const hangouts = sqliteTable("hangouts", {
  id: int().primaryKey({ autoIncrement: true }),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  date: text().notNull(),
  startHour: int("start_hour").notNull(),
  /** Exclusive, so 19–21 is two hours. 24 is midnight. */
  endHour: int("end_hour").notNull(),
  title: text().notNull(),
  proposedBy: int("proposed_by")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const rsvps = sqliteTable(
  "rsvps",
  {
    hangoutId: int("hangout_id")
      .notNull()
      .references(() => hangouts.id, { onDelete: "cascade" }),
    memberId: int("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    response: text({ enum: ["in", "out"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.hangoutId, t.memberId] })],
);

export type Group = typeof groups.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Hangout = typeof hangouts.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;

import { sql } from "drizzle-orm";
import { check, index, int, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/** A person, across every group they're in: a name, the token that is both
 *  their cookie and their private sign-in link, and a shareable friend code.
 *  No password: the token is the credential (ADR 4). */
export const people = sqliteTable("people", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  token: text().notNull().unique(),
  friendCode: text("friend_code").notNull().unique(),
  /** IANA zone their events' times are wall-clock times in. */
  timezone: text().notNull(),
  /** How they look: an uploaded photo (a file in uploads), else an emoji,
   *  else their initials. */
  avatarPhoto: text("avatar_photo"),
  avatarEmoji: text("avatar_emoji"),
  bio: text(),
  createdAt: createdAt(),
});

/** A friend group. Its id is also the invite secret: anyone with the link
 *  can join, which is the whole of the access model. */
export const groups = sqliteTable("groups", {
  id: text().primaryKey(),
  name: text().notNull(),
  /** IANA zone the group's hours are wall-clock times in. */
  timezone: text().notNull(),
  /** The admin's membership (a member id, not a person); if it's gone, the
   *  longest-standing member is admin (src/lib/manage.ts). */
  adminId: int("admin_id"),
  /** Archived groups are read-only. */
  archivedAt: text("archived_at"),
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
    /** The profile behind this membership; null for memberships made before
     *  profiles existed, until their owner makes one and claims them. */
    personId: int("person_id").references(() => people.id, { onDelete: "set null" }),
    /** No notifications from this group. */
    muted: int({ mode: "boolean" }).notNull().default(false),
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
  /** Null once the member who proposed it has left or been removed: the plan
   *  is the group's, and outlives them. */
  proposedBy: int("proposed_by").references(() => members.id, { onDelete: "set null" }),
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

/** A friend request, and once accepted, a friendship. Friends are accepted
 *  rows in either direction. */
export const friendships = sqliteTable(
  "friendships",
  {
    requesterId: int("requester_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    addresseeId: int("addressee_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    status: text({ enum: ["pending", "accepted"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.requesterId, t.addresseeId] })],
);

/** An event someone hosts. Public: anyone with the link, listed on Explore.
 *  Private: the host and the people they invite (ADR 5). The URL carries
 *  shareId, not id, so private events can't be found by counting. */
export const events = sqliteTable("events", {
  id: int().primaryKey({ autoIncrement: true }),
  shareId: text("share_id").notNull().unique(),
  hostId: int("host_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  title: text().notNull(),
  details: text().notNull().default(""),
  location: text().notNull().default(""),
  /** YYYY-MM-DD and HH:MM, wall-clock in `timezone`. */
  date: text().notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  timezone: text().notNull(),
  visibility: text({ enum: ["public", "private"] }).notNull(),
  /** Spots for guests (the host doesn't take one); null means no limit. */
  capacity: int(),
  /** How many +1s each guest may bring; they take spots too. */
  maxPlusOnes: int("max_plus_ones").notNull().default(0),
  /** When RSVPs close (wall-clock in `timezone`); null means they don't. */
  rsvpByDate: text("rsvp_by_date"),
  rsvpByTime: text("rsvp_by_time"),
  /** The cover's theme (see src/lib/covers.ts). */
  cover: text().notNull().default("sunset"),
  createdAt: createdAt(),
});

/** Who's invited to an event, and what they've said. The host is going. */
export const eventGuests = sqliteTable(
  "event_guests",
  {
    eventId: int("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    personId: int("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    invitedBy: int("invited_by").references(() => people.id, { onDelete: "set null" }),
    response: text({ enum: ["invited", "going", "maybe", "declined", "waitlisted"] }).notNull(),
    plusOnes: int("plus_ones").notNull().default(0),
    /** Arrival order on the waitlist (ADR 6): a strictly increasing stamp, so
     *  two people waitlisted in the same millisecond still have an order. */
    waitlistSeq: int("waitlist_seq"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.personId] })],
);

/** Talk about a plan: a comment on exactly one event or one hangout, so the
 *  conversation lives with the plan and goes when it does. */
export const comments = sqliteTable(
  "comments",
  {
    id: int().primaryKey({ autoIncrement: true }),
    eventId: int("event_id").references(() => events.id, { onDelete: "cascade" }),
    hangoutId: int("hangout_id").references(() => hangouts.id, { onDelete: "cascade" }),
    authorId: int("author_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("comments_one_target", sql`(${t.eventId} IS NULL) != (${t.hangoutId} IS NULL)`),
    index("comments_event").on(t.eventId),
    index("comments_hangout").on(t.hangoutId),
  ],
);

/** One reaction per person per plan, like Facebook: changing it replaces
 *  it. The unique indexes hold that (SQLite treats the NULL side of each as
 *  distinct, so event and hangout reactions never collide). */
export const reactions = sqliteTable(
  "reactions",
  {
    id: int().primaryKey({ autoIncrement: true }),
    eventId: int("event_id").references(() => events.id, { onDelete: "cascade" }),
    hangoutId: int("hangout_id").references(() => hangouts.id, { onDelete: "cascade" }),
    personId: int("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    emoji: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("reactions_one_target", sql`(${t.eventId} IS NULL) != (${t.hangoutId} IS NULL)`),
    uniqueIndex("reactions_event_person").on(t.eventId, t.personId),
    uniqueIndex("reactions_hangout_person").on(t.hangoutId, t.personId),
  ],
);

/** Something that happened that a person should hear about: a request, an
 *  invite, a comment on their plan. Read when they open it. */
export const notifications = sqliteTable(
  "notifications",
  {
    id: int().primaryKey({ autoIncrement: true }),
    personId: int("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    text: text().notNull(),
    /** Where opening it goes: always a path on this site. */
    href: text().notNull(),
    actorId: int("actor_id").references(() => people.id, { onDelete: "set null" }),
    readAt: text("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_person").on(t.personId, t.id)],
);

/** A question asked on one plan: "Pizza or tacos?". */
export const polls = sqliteTable(
  "polls",
  {
    id: int().primaryKey({ autoIncrement: true }),
    eventId: int("event_id").references(() => events.id, { onDelete: "cascade" }),
    hangoutId: int("hangout_id").references(() => hangouts.id, { onDelete: "cascade" }),
    createdBy: int("created_by")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    question: text().notNull(),
    /** Several answers each, rather than one. */
    multi: int({ mode: "boolean" }).notNull().default(false),
    closedAt: text("closed_at"),
    createdAt: createdAt(),
  },
  (t) => [check("polls_one_target", sql`(${t.eventId} IS NULL) != (${t.hangoutId} IS NULL)`)],
);

export const pollOptions = sqliteTable("poll_options", {
  id: int().primaryKey({ autoIncrement: true }),
  pollId: int("poll_id")
    .notNull()
    .references(() => polls.id, { onDelete: "cascade" }),
  label: text().notNull(),
});

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    optionId: int("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    pollId: int("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    personId: int("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.optionId, t.personId] })],
);

/** People an admin removed from a group, who can't rejoin it by the link. */
export const groupBans = sqliteTable(
  "group_bans",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    personId: int("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.personId] })],
);

/** Who nudged whom to mark which week, so a nudge is once a week. */
export const nudges = sqliteTable(
  "nudges",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromPersonId: int("from_person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    toMemberId: int("to_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    week: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.fromPersonId, t.toMemberId, t.week] })],
);

/** Stretches a whole group was told it shares, so each is announced once. */
export const everyoneFree = sqliteTable(
  "everyone_free",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    date: text().notNull(),
    startHour: int("start_hour").notNull(),
    endHour: int("end_hour").notNull(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.date, t.startHour, t.endHour] })],
);

/** A photo in a plan's album, stored as a file in the uploads folder on
 *  the volume (src/lib/media.ts). */
export const photos = sqliteTable(
  "photos",
  {
    id: int().primaryKey({ autoIncrement: true }),
    eventId: int("event_id").references(() => events.id, { onDelete: "cascade" }),
    hangoutId: int("hangout_id").references(() => hangouts.id, { onDelete: "cascade" }),
    uploaderId: int("uploader_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    file: text().notNull().unique(),
    mime: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("photos_one_target", sql`(${t.eventId} IS NULL) != (${t.hangoutId} IS NULL)`)],
);

/** "How was it?", 1–5, one each per plan. */
export const ratings = sqliteTable(
  "ratings",
  {
    id: int().primaryKey({ autoIncrement: true }),
    eventId: int("event_id").references(() => events.id, { onDelete: "cascade" }),
    hangoutId: int("hangout_id").references(() => hangouts.id, { onDelete: "cascade" }),
    personId: int("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    score: int().notNull(),
  },
  (t) => [
    check("ratings_one_target", sql`(${t.eventId} IS NULL) != (${t.hangoutId} IS NULL)`),
    uniqueIndex("ratings_event_person").on(t.eventId, t.personId),
    uniqueIndex("ratings_hangout_person").on(t.hangoutId, t.personId),
  ],
);

/** Who has blocked whom. */
export const blocks = sqliteTable(
  "blocks",
  {
    blockerId: int("blocker_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    blockedId: int("blocked_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

/** That a member has answered for a week (marked hours, or "none of these
 *  work"): until they have, the group's hours for it stay hidden from them
 *  (ADR 10). */
export const weekAnswers = sqliteTable(
  "week_answers",
  {
    memberId: int("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    week: text().notNull(),
    answeredAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.week] })],
);

export type Notification = typeof notifications.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventGuest = typeof eventGuests.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Hangout = typeof hangouts.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;

/** Append-only record of who did what (crit 10): one row per state change or
 *  refusal, also printed to stdout for `flyctl logs`. Never holds a token,
 *  friend code, sign-in link or message body. Not tied to people by a foreign
 *  key: the record outlives whoever it names. */
export const activity = sqliteTable(
  "activity",
  {
    id: int().primaryKey({ autoIncrement: true }),
    /** ISO-8601 UTC, to the second. */
    at: text().notNull(),
    actorId: int("actor_id"),
    /** `p12 "Ana"`, `m7 "Ben"` or `anon`. */
    actorLabel: text("actor_label").notNull(),
    action: text().notNull(),
    target: text().notNull(),
    /** `ok`, or `denied (reason)`. */
    outcome: text().notNull(),
    detail: text(),
  },
  (t) => [index("activity_at").on(t.at)],
);

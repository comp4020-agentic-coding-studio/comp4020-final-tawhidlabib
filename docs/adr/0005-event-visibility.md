# 5. Events are public or private, and private means invited

Date: 2026-10-07 · Status: accepted

## Context

Events are Hangout's Facebook-style feature: someone hosts a thing at a
time and place, and people say whether they're going. The question is who
can see one. That decides whether Hangout can be a place to find things to
do, and whether a surprise party stays a surprise.

## Options

- **Public or Private.** Public: anyone with the link can see it and RSVP,
  and it's listed on Explore. Private: only the host and the people they
  invite.
- **Public, Friends or Private,** like Facebook. A middle level, but it
  makes "who can see this?" a question you have to think about each time.
- **Friends or Private,** with nothing visible to strangers. Safer, but
  there's nothing to explore and no way to open an event up.

## Decision

Two levels, explained in the form as you choose.

- Private is enforced on every surface: the event page, its `.ics` and
  RSVPs all answer 403 to anyone who isn't the host or a guest.
- The URL carries a random `share_id`, not the row id, so private events
  can't be found by counting.
- Invites only reach people the host already knows, friends and group-mates.
  Ids posted from the form are checked against that set, so nobody can
  invite strangers by guessing ids.
- Inviting a whole group invites everyone in it with a profile.

`spec/events.test.ts` holds the private rule: a stranger and an uninvited
friend both get 403.

## What it costs

There's no "friends can see it" middle ground. A host who wants all their
friends has to tick them, or invite whole groups. A public event's link,
once shared, can travel anywhere. Members of a group who never made a
profile can't be invited until they do.

## Later

Events grew spot limits and a waitlist ([ADR 6](0006-the-last-spot.md)),
+1s, an RSVP deadline, covers, host editing, comments, polls and a photo
album. All of them follow the same rule: private means only the host and
guests, so the event's thread, album and live updates answer 403 to
everyone else.

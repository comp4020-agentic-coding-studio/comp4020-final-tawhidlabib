# 6. The last spot goes to whoever's first, and the waitlist fills itself

Date: 2026-10-07 · Status: accepted (crit 9)

## Context

Hangout is real-time now: a change one person makes reaches every other
open page within a second. That raises a question the app never had while
it was one person at a time: **what happens when two people want the last
spot at a full event at the same moment?**

Events can have a spot limit, and +1s take spots too. At a showcase, or with
a group chat sharing one link, several people can tap Going on the last spot
within the same second. Somebody has to get it. Everyone else needs to know
straight away, not after a reload, and not after they've already told
friends they're in.

## Options

1. **First in, waitlist auto-fills.** Whoever's request reaches the server
   first gets the spot. Everyone after joins a waitlist in arrival order and
   is told at once. When anyone leaves (says Maybe or Can't go, or drops a
   +1), the earliest person waiting who fits moves in automatically and is
   pushed a notice wherever they are on the site.
2. **First in, spot offered.** The same race, but a freed spot is *offered*
   to the first person waiting for 2 hours (claim it or pass), then to the
   next.
3. **Host picks.** Once the event is full, Going becomes a request, and the
   host approves people.
4. **Lottery at the deadline.** Over-capacity RSVPs before the RSVP deadline
   go into a draw at the deadline.

## Decision

**Option 1.** The README says a good Hangout "answers the question,
honestly" and "ends in a calendar". Option 1 is the only one where every tap
gets a definite answer the moment it's made: you're in, or you're #2 on the
waitlist. A spot that frees up is filled without anyone having to act, so
nobody's waiting on the host to check their phone (3), nobody's waiting days
for a draw (4), and no spot sits empty behind a 2-hour offer (2).

**How it's enforced.** Answering Going is one SQLite transaction (`respond()`
in `src/lib/events.ts`): count the spots taken, decide going or waitlisted,
write it, and fill any free spots from the waitlist. better-sqlite3 runs
transactions one at a time, so of two taps on the last spot exactly one sees
it free. Waitlist order is a strictly increasing stamp, so two taps in the
same millisecond still have an order. The host doesn't take a spot. +1s do,
capped at what the host allows, so nobody takes extra spots by asking for
more. The change is published on the event's live topic, and each person
moved in from the waitlist gets a push on their own topic.
`spec/waitlist.test.ts` holds the rule: five simultaneous taps on one spot
leave exactly one going and four waiting, and the first person waiting moves
in when someone drops.

**What counts as "first".** Arrival at the server, not the moment of the
tap. Network latency decides close races, and that's invisible to the
people racing. We accept that: any fairer clock would need trusting their
devices.

## What it costs

- **It rewards being online and quick.** Someone on a slow connection, or
  who sees the link an hour late, loses to whoever was watching. A lottery
  (4) is fairer to them, and that's the strongest argument against this
  choice.
- **People can be moved into plans they've half forgotten.** Auto-fill
  commits someone the moment a spot frees, perhaps days after they joined
  the waitlist. The push notice (and the inbox, once it lands) is what makes
  that acceptable, so it has to be hard to miss. Being able to leave the
  waitlist with one tap is the safety valve.
- **A big party can be skipped.** If the first person waiting has +1s and
  the free spot can't fit them all, a smaller party behind them moves in
  first. Strict order would leave the spot empty instead. We chose a full
  room over strict order.
- **It assumes one machine.** The transaction is the referee only because
  there's one database file and one process. If Hangout ever ran on several
  machines, the live channel and this decision would need a shared database
  or queue.

## Later

ADR 6 promised that a promotion notice would be hard to miss. It is: a live
push wherever the person is on the site, and an inbox item that waits for
them ([ADR 7](0007-notifications-in-app.md)). A host raising the spot limit
moves people in by the same rule, and they're told the same way.

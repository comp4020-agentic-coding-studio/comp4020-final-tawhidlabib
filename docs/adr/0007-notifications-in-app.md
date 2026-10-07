# 7. Notifications live in the app, not on your phone

Date: 2026-10-07 · Status: accepted

## Context

Once Hangout had friends, invites, comments, polls and a waitlist, people
needed to hear about things that happened while they weren't looking: a
friend request, an invite, a reply on a plan, a spot opening up (which
[ADR 6](0006-the-last-spot.md) promises to tell people about).

## Options

- **An in-app inbox, live.** A bell in the navigation counts what you
  haven't read, and updates live while you're anywhere on the site. `/inbox`
  lists everything.
- **The inbox plus browser push.** Notifications on your phone or desktop
  even when Hangout isn't open. That needs a service worker, push keys kept
  as a Fly secret, and asking everyone for permission.
- **Email.** Hangout doesn't know anyone's email address (ADR 4), and asking
  for one would undo "joining costs a name, nothing else".

## Decision

The in-app inbox, live. `notify()` in `src/lib/notify.ts` is the only way a
notification is made:
- It writes one row per person.
- It never notifies whoever caused it, nor anyone who has blocked them, nor
  anyone who has muted the group it came from ([ADR 9](0009-block-and-mute.md)).
- It pushes on each person's live topic, so their bell updates at once.

Opening an item marks it read and goes to it. Anyone else's notification id
answers "not found", so ids reveal nothing.

## What it costs

You only hear about things when you next open Hangout. That matters most
for a waitlist promotion: you might be "going" for a day before you notice.
Push notifications are the obvious next step if that bites. The inbox is
designed so adding push later is one more delivery path inside `notify()`,
not a rewrite.

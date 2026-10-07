# 9. Blocking is silent and one-way; muting is per group

Date: 2026-10-07 · Status: accepted

## Context

A social app needs a way to have less of someone. Hangout's people are small
groups of friends, but friends fall out, and invite links travel. The
question is what "block" means: what stops, who can tell, and whether a
group can be quietened without leaving it.

## Options

- **Block hides everything both ways.** Neither of you sees the other
  anywhere, including in shared groups and on shared events.
- **Block stops them reaching you, silently.** Their requests, invites and
  notifications don't arrive, and their comments are hidden *from you*, but
  shared groups and events carry on for everyone else.
- **No block, only leaving.** Leave the group, decline the event.

## Decision

**Silent and one-way** (`src/lib/blocks.ts`):
- **It ends any friendship.** Neither of you can start one again.
- **What stops reaching you:** their friend requests, their invites (they
  can't add you), and their notifications.
- **What's hidden from you:** their comments. Nobody else's view changes.
- **What's kept from both of you:** suggesting either of you to the other
  as "people you may know".
- **They aren't told.** Telling someone they've been blocked can escalate
  things, so a blocked request simply goes nowhere.

**Mute** is separate and per group: a muted group's news stays out of your
inbox until you unmute it. It's for the group that's too chatty, not for a
person.

Both are enforced where the effect happens: in `notify()`, in
`requestFriend()`, in who may be invited, and in `commentsOn()`. So every
current and future notification respects them. `spec/profile-plus.test.ts`
holds the rules.

## What it costs

Hiding everything both ways (option 1) would break shared groups: the grid,
best times and "everyone's free" would mean different things to different
people. So a blocked person can still see your hours and plans in a group
you both stay in. Leaving the group, or an admin removing someone (which
stops them rejoining by the link), is the stronger tool. A silent block can
be confusing for the person who keeps getting no answer, and we accept that.

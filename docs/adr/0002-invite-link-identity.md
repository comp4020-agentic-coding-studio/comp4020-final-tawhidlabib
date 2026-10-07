# 2. A person is a name and a cookie, per group

Date: 2026-10-06 · Status: superseded by [ADR 4](0004-profiles-with-a-sign-in-link.md) (crit 8)

## Context

The brief leaves "what counts as a person" to me. At the crit, strangers in
my pod have to get into a group in seconds, on their own phones. The friends
Hangout is for include people who won't make an account to pick a dinner
time.

## Options

- **Name + invite link.** The group's id is an unguessable secret in its
  link. Anyone with the link picks a name, and a cookie remembers them.
- **Google sign-in.** Real identities, and the way to write straight into
  Google Calendar later. But it needs OAuth setup, and until Google verifies
  the app only listed test users can sign in.
- **Username and password.** I'd be building account recovery for an app
  whose whole point is low friction.

## Decision

Name + invite link. The 12-character group id is the invite secret. Names
are unique within a group, ignoring case. Each group gets its own `hg_<id>`
cookie holding a random token, so the same person can be in several groups
and the front page can list them all.

## What it costs

Identity lives in one browser. Clear the cookie or switch devices and you
can't get back in as yourself, because your name is taken. Anyone the link
is forwarded to can join. For a friend group that's the same trust as the
group chat, but it isn't access control. If it hurts in use, the fix is a
"rejoin" link, not accounts.

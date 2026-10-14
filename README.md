# Hangout

Most group plans die in the group chat: forty messages of "I'm free
Thursday-ish", and nobody ever says "so, Thursday at 7". Hangout carries a
plan through its whole life instead, from "we should hang out" to a time, to
showing up, to remembering it. Someone sends a link; everyone taps the hours
they're free this week, **before they can see anyone else's**; Hangout finds
the longest stretch the most of you share; you say you're in, and it lands in
your calendar.

Try it live at
[comp4020-final-tawhidlabib.fly.dev](https://comp4020-final-tawhidlabib.fly.dev/)
in two browser profiles.

## What good means here

Good is beating the group chat at each step of a plan's life. A feature
earns its place only by moving a plan on:

1. **Joining costs a name.** The friend who hates signing up still joins: no
   passwords, no app. A private link signs you in elsewhere.
2. **It gets honest answers.** You mark your week before you see the
   group's ([the blind grid](#the-blind-grid)). Then Hangout recommends the
   longest shared stretch, and says who it leaves out.
3. **This week, not a template.** Hours belong to one week; schedules go
   stale.
4. **It ends in a calendar.** "I'm in" gives you a Google Calendar link and
   an `.ics` file.
5. **It's live.** Hours, replies and RSVPs appear as they happen, and a full
   event's last spot goes to the first tap
   ([ADR 6](docs/adr/0006-the-last-spot.md)).
6. **It holds up** on a phone, from a keyboard, on a bad connection, and
   without JavaScript.

## Why not the alternatives

When2meet shows everyone's paint as you paint yours, then stops at the
overlap. Doodle starts from times one organiser guesses. The group chat
never stops at all. Hangout asks first, shows second, and ends with a plan.

### The blind grid

In open Doodle polls people approve what already looks popular, to seem
cooperative, rather than when they're really free
([Zou, Meir & Parkes, 2015](https://dash.harvard.edu/handle/1/33009592)).
How people answer also follows social norms
([Reinecke et al., 2013](https://dash.lib.harvard.edu/handle/1/12561360)).
An open grid gets a group's performed week; a blind one gets its real week
([ADR 10](docs/adr/0010-the-blind-grid.md)).

### Generic, but situated

Robin Sloan's
[An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/)
praises an app "no one else will ever use", and Clay Shirky's
[Situated Software](https://gwern.net/doc/technology/2004-03-30-shirky-situatedsoftware.html)
software "designed for use by a specific social group". Both argue against
building for any small group. I took that tension on: Hangout is generic,
but each group's copy is its own link, names and week.

## What I chose not to build

- **Passwords and Google sign-in.** Calendar writes need OAuth, which an
  unverified app offers only to test users. Links do the job.
- **A chat.** Comments live on a plan; Hangout ends the group chat rather
  than becoming one.

The cost of no passwords: whoever holds your sign-in link is you.

## What's enforced, and what's judged

`spec/` enforces these against the running app:
- a stranger with the link can join, and hours survive a cold restart
- the top recommendation is the longest shared stretch
- calendar times are right across a daylight-saving change
- nobody sees the group's week before marking their own
- private plans answer 403 to outsiders, and blocked people can't reach you
- a change reaches other open pages within a second
- of simultaneous taps on a last spot, exactly one wins
- the keyboard, a resize, and a slow or dropped connection, in real Chrome

Judged: whether Hangout beats the group chat, whether blind answers are
more honest, and how fast a newcomer gets in. The measured floor: two people
from link to calendar in 12 actions. Sessions with real friend groups are
in [docs/judging.md](docs/judging.md); results go here once they've run.

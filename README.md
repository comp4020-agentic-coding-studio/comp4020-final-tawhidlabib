# Hangout

Most group plans die in the group chat: forty messages of "I'm free
Thursday-ish", and nobody ever says "so, Thursday at 7". Hangout carries a
plan through its whole life instead, from "we should hang out" to
remembering it. Someone sends a link; everyone taps the hours
they're free this week, **before seeing anyone else's**; Hangout finds the
longest stretch most of you share; you say you're in, and it's in your
calendar.

Try it at
[comp4020-final-tawhidlabib.fly.dev](https://comp4020-final-tawhidlabib.fly.dev/)
in two browser profiles.

## What good means here

Good is beating the group chat at each step of a plan's life. A feature
earns its place by moving a plan on:

1. **Joining costs a name.** No passwords, no app: the friend who hates
   signing up still joins. A private link signs you in elsewhere.
2. **It gets honest answers.** You mark your week before you see the
   group's ([the blind grid](#the-blind-grid)). Then Hangout recommends the
   longest shared stretch, and says who it leaves out.
3. **This week, not a template.** Hours belong to one week.
4. **It ends in a calendar.** "I'm in" gives you a Google Calendar link and
   an `.ics` file.
5. **It's live.** Hours, replies and RSVPs appear as they happen, and a full
   event's last spot goes to the first tap
   ([ADR 6](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/docs/adr/0006-the-last-spot.md)).
6. **It holds up** on a phone, from a keyboard, on a bad connection, and
   without JavaScript.
7. **It's remembered.** Once the day comes, the people who went add photos
   and a rating to the plan.

## Why not the alternatives

When2meet shows everyone's paint as you paint yours, then stops at the
overlap. Doodle starts from one organiser's guesses, and hides answers only
on a paid plan, forever, even from those who answered. The group chat never
stops. Hangout asks first, shows second, and ends with a plan.

### The blind grid

In open Doodle polls people approve what already looks popular, to seem
cooperative, rather than when they're really free
([Zou, Meir & Parkes, 2015](https://dash.harvard.edu/handle/1/33009592)).
How people answer also follows social norms
([Reinecke et al., 2013](https://dash.harvard.edu/handle/1/12561360)).
An open grid gets a group's performed week; a blind one, its real week
([ADR 10](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/docs/adr/0010-the-blind-grid.md)).

Robin Sloan's
[home-cooked app](https://www.robinsloan.com/notes/home-cooked-app/) is
one "no one else will ever use"; Clay Shirky's
[situated software](https://gwern.net/doc/technology/2004-03-30-shirky-situatedsoftware.html)
is "designed for use by a specific social group". Hangout is generic, but
each group's copy is its own.

## What I chose not to build

- **Passwords and Google sign-in.** Calendar writes need OAuth, which an
  unverified app offers only to test users.
- **A chat.** Comments live on a plan; Hangout ends the group chat rather
  than becoming one.
- **A feed, followers or discovery.** Friends exist only to invite to
  one-off events; Explore lists only events their hosts made public; block
  and mute exist because those two let strangers reach you.

The cost of no passwords: whoever holds your sign-in link is you. Access
is checked on the server
([ADR 11](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/docs/adr/0011-who-may-see-and-change-what.md)).

## What's enforced, and what's judged

`spec/` enforces, against the running app:
- a stranger with the link joins; hours survive a restart
- the top recommendation is the longest shared stretch, naming who it misses
- calendar times survive daylight saving
- nobody sees the group's week before marking their own
- nobody reads or changes another's things; every change is logged by who
- a change reaches other open pages within a second
- of simultaneous taps on a last spot, exactly one wins
- keyboard, resize, slow or dropped connection and accessibility, in real
  Chrome

Judged: whether Hangout beats the group chat, whether blind answers are
more honest, and how fast a newcomer gets in (measured floor: link to
calendar for two people in 12 actions). Sessions with real groups:
[docs/judging.md](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/docs/judging.md).

Every source is real and checked; only the front page's demo group is
made up.

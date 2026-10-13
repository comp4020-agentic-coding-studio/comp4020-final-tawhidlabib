# Hangout

Hangout carries a small group's plan through its whole life: from "we
should hang out" to a time, to showing up, to remembering it.
Someone sends a link; everyone taps the hours they're free this week; Hangout
finds the longest stretch the most of you share; you say you're in, it lands
in your calendar, and afterwards the photos land in the plan.

It's live at
[comp4020-final-tawhidlabib.fly.dev](https://comp4020-final-tawhidlabib.fly.dev/).

## What good means here

A good Hangout beats the group chat, where plans go to die: forty messages
of "I'm free Thursday-ish", and nobody says "so, Thursday at 7". Each
feature earns its place by moving a plan one step on:

1. **Joining costs a name.** The friend who hates signing up still joins: no
   passwords, no app; a private link signs you in elsewhere.
2. **It answers the question, honestly.** You mark your week before you
   see anyone else's ([the blind grid](#the-blind-grid)); then it recommends
   the longest stretch the most people share, and says who that leaves out.
3. **This week, not a template.** Hours belong to one week; schedules go
   stale.
4. **It ends in a calendar.** Saying "I'm in" gives you an Add to Google
   Calendar link and an `.ics` file.
5. **It holds up:** on a phone, from a keyboard, on a slow or dropped
   connection, and without JavaScript.
6. **It's live.** Hours, replies and RSVPs appear as they happen; a full
   event's last spot goes to the first tap
   ([ADR 6](docs/adr/0006-the-last-spot.md)).

## What I read and looked at

Robin Sloan's
[An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/)
(2020) is about a messaging app he made for his family: "It is ruthlessly
simple; we love it; no one else will ever use it." Clay Shirky's
[Situated Software](https://gwern.net/doc/technology/2004-03-30-shirky-situatedsoftware.html)
(2004) describes software "designed for use by a specific social group,
rather than for a generic set of 'users'."

Both pull against building for *any* small group, and that tension is the
design: Hangout is generic, but each group's copy is situated, with its own
link, names and week. When2meet stops at the overlap; Doodle starts from one
organiser's guesses.

### The blind grid

In open Doodle polls people approve what already looks popular, to seem
cooperative, rather than when they're really free
([Zou, Meir & Parkes, 2015](https://dash.harvard.edu/handle/1/33009592));
how people answer also follows social norms
([Reinecke et al., 2013](https://dash.lib.harvard.edu/handle/1/12561360)).
So Hangout hides the group's week until you've marked yours
([ADR 10](docs/adr/0010-the-blind-grid.md)).

## What I chose not to build

- **Passwords and Google sign-in.** Calendar writes need OAuth, which an
  unverified app offers only to test users; links do the job.
- **A chat or recurring availability.** Comments live on a plan; Hangout's
  job is to end the group chat.

The cost of no passwords: whoever holds your sign-in link is you.

## What's enforced, and what's judged

`spec/` enforces these, against the running app:
- a stranger with the link can join
- your free hours survive a cold restart
- the top recommendation is the longest shared stretch, and can be shortened
- calendar times are right across a daylight-saving change
- a private event answers 403 to anyone not invited, and only a plan's
  people can comment or react
- a change reaches other open pages within a second
- of simultaneous taps on a last spot, exactly one wins
- nobody sees the group's week before marking their own
- someone you've blocked can't reach you
- the keyboard, a resize, a slow or dropped connection (real Chrome)

Judged: whether it beats the group chat, whether blind answers are more
honest, how fast a newcomer gets in. [How I judge them](docs/judging.md):
real groups planning real hangouts, four questions after, and a measured
floor (two people, link to calendar: 12 actions, about 4 seconds).

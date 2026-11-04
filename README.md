# Hangout

My tutor, Bill, agreed I could use my app's landing page as my README.
[Read it on the landing page](https://comp4020-final-tawhidlabib.fly.dev/welcome#readme).
If you'd rather, the plain text below is the same README, but it won't
read as well: it was written for the landing page.

## What good means here

→ [On the landing page: Good means beating the group chat, every step](https://comp4020-final-tawhidlabib.fly.dev/welcome#every-step)

Most plans die in the group chat. Good is beating it at each step of a
plan's life, from "we should hang out" to remembering it. A feature earns
its place by moving a plan on:

1. **Joining costs a name.** No passwords, no app: the friend who hates
   signing up still joins. A private link signs you in elsewhere.
2. **It gets honest answers.** You mark your week before you see the
   group's ([the blind grid](#the-blind-grid)). Then Hangout recommends the
   longest shared stretch, naming who it leaves out.
3. **This week, not a template.** Hours belong to one week.
4. **It ends in a calendar.** "I'm in" gives you a Google Calendar link and
   an `.ics` file.
5. **It's live.** Changes appear at once, and a full event's last spot
   goes to the first tap
   ([ADR 6](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/docs/adr/0006-the-last-spot.md)).
6. **It holds up** on a phone, a keyboard, a bad connection, without
   JavaScript.
7. **It's remembered.** Afterwards, whoever went adds photos and a
   rating.

## What I read and looked at

→ [On the landing page: Why your honest week matters](https://comp4020-final-tawhidlabib.fly.dev/welcome#honest-week)

When2meet shows everyone's paint as you paint yours, then stops at the
overlap. Doodle starts from one organiser's guesses, and hides answers only
on a paid plan, forever, even from those who answered. Hangout asks first,
shows second, and ends with a plan.

### The blind grid

In open Doodle polls people approve what already looks popular, to seem
cooperative, rather than when they're really free
([Zou, Meir & Parkes, 2015](https://dash.harvard.edu/handle/1/33009592)).
How people answer also follows social norms
([Reinecke et al., 2013](https://dash.harvard.edu/handle/1/12561360)).
An open grid gets a group's performed week; a blind one, its real week
([ADR 10](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/docs/adr/0010-the-blind-grid.md)).

## What I chose not to build

→ [On the landing page: Built for your friends, not everyone](https://comp4020-final-tawhidlabib.fly.dev/welcome#left-out)

Robin Sloan's
[home-cooked app](https://www.robinsloan.com/notes/home-cooked-app/) is
one "no one else will ever use"; Clay Shirky's
[situated software](https://gwern.net/doc/technology/2004-03-30-shirky-situatedsoftware.html)
is "designed for use by a specific social group". Hangout is generic, but
each group's copy is its own.

- **Passwords and Google sign-in.** Calendar writes need OAuth, which an
  unverified app offers only to test users.
- **A chat.** Comments live on a plan; Hangout ends the group chat rather
  than becoming one.
- **A feed, followers or discovery.** Friends exist only to invite to
  one-off events; Explore lists only events their hosts made public; block
  and mute exist because those let strangers reach you.

The cost of no passwords: whoever holds your sign-in link is you. Access
is checked server-side
([ADR 11](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/docs/adr/0011-who-may-see-and-change-what.md)).

## What's enforced, and what's judged

→ [On the landing page: How we know it works](https://comp4020-final-tawhidlabib.fly.dev/welcome#how-we-know)

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

Judged, with real groups
([docs/judging.md](https://github.com/comp4020-agentic-coding-studio/comp4020-final-tawhidlabib/blob/main/docs/judging.md)):
whether Hangout beats the group chat (a plan, in fewer messages), whether
blind answers are more honest (each asked afterwards), and how fast a
newcomer gets in (timed, unhelped; floor: link to calendar for two in 12
actions).

Every source is real and checked; the demo group and chat are made
up.

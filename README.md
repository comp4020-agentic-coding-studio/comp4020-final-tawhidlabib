# Hangout

Hangout gets a small group of friends from "we should hang out" to a time
that's in everyone's calendar. Someone starts a group and sends the link.
Everyone taps the hours they're free this week. Hangout finds the longest
stretch the most of you share, anyone can turn it into a plan, and whoever's
in can add it to their calendar in one click.

It's live at
[comp4020-final-tawhidlabib.fly.dev](https://comp4020-final-tawhidlabib.fly.dev/).

## What good means here

A good Hangout is one that beats the group chat. That chat is where plans go
to die: forty messages of "I'm free Thursday-ish", and nobody ever says
"so, Thursday at 7". So, for Hangout:

1. **Joining costs a name, nothing else.** If the link is the membership, the
   friend who hates signing up for things still joins. No accounts, no
   passwords, no app to install.
2. **It answers the question, honestly.** Hangout doesn't just show a
   heatmap. It recommends the longest stretch the most people share, and
   it says who that leaves out ("3 of 4 free: you, Ana, Ben"), so nobody
   has to guess who can't come.
3. **This week, not a template.** People's weeks aren't the same twice, so
   free hours belong to a specific week. A recurring schedule goes stale.
4. **It ends in a calendar.** A plan isn't real until it's in the calendar.
   Saying "I'm in" gives you an Add to Google Calendar link and an `.ics`
   file for everything else.
5. **It works on the phone in your pocket,** and the core works without
   JavaScript.

## What I read and looked at

Robin Sloan's
[An app can be a home-cooked meal](https://www.robinsloan.com/notes/home-cooked-app/)
(2020) is about a messaging app he made for his family: "It is ruthlessly
simple; we love it; no one else will ever use it." Clay Shirky's
[Situated Software](https://gwern.net/doc/technology/2004-03-30-shirky-situatedsoftware.html)
(2004) describes software "designed for use by a specific social group,
rather than for a generic set of 'users'."

Both pull against my choice to build for *any* small group, and that tension
is the design. Hangout is generic, but each group's copy is situated: its own
link, its own names, its own week. Nothing about it is shared between groups.

I also looked at what people use now. When2meet gets everyone to paint a
grid, then stops at the overlap. Doodle starts from a few times one organiser
guesses at. Hangout starts from everyone's real week, and ends with a plan.

## What I chose not to build

- **Accounts and Google sign-in.** Writing straight into Google Calendar
  would mean OAuth, and an unverified app that only listed test users can
  use. My pod couldn't use that at the crit. Links do the same job without
  the wall.
- **Chat, notifications, recurring availability.** The group chat already
  exists, and Hangout's job is to end it.

The cost of no accounts: your identity is a cookie in one browser. On a new
device you can't rejoin under your old name.

## What's enforced, and what's judged

`spec/crit-8.test.ts` enforces these, against the running app:
- a stranger with the link can join
- your free hours come back after a cold server restart, and the group can
  see them
- the top recommendation is the longest shared stretch
- a proposal can be shortened
- calendar times are right across a daylight-saving change

The quality floor checks accessibility basics on every page state. Whether
the recommendations feel right, and whether Hangout really beats the group
chat, are judged: first by my pod using it together at the crit.

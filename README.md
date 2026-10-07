# Hangout

Hangout gets a small group of friends from "we should hang out" to a time
that's in everyone's calendar. Someone starts a group and sends the link.
Everyone taps the hours they're free this week. Hangout finds the longest
stretch the most of you share, anyone can turn it into a plan, and whoever's
in can add it to their calendar in one click. You can also add friends, host
events, and see every plan on one calendar.

It's live at
[comp4020-final-tawhidlabib.fly.dev](https://comp4020-final-tawhidlabib.fly.dev/).

## What good means here

A good Hangout is one that beats the group chat. That chat is where plans go
to die: forty messages of "I'm free Thursday-ish", and nobody ever says
"so, Thursday at 7". So, for Hangout:

1. **Joining costs a name, nothing else.** If the link is the membership, the
   friend who hates signing up for things still joins. No passwords, no
   app: your name is your profile, and a private link signs you in elsewhere.
2. **It answers the question, honestly.** It recommends the longest
   stretch the most people share, and says who that leaves out ("3 of 4 free: you, Ana, Ben"), so nobody
   has to guess who can't come.
3. **This week, not a template.** People's weeks aren't the same twice, so
   free hours belong to a specific week. A recurring schedule goes stale.
4. **It ends in a calendar.** Saying "I'm in" gives you an Add to Google
   Calendar link and an `.ics` file.
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
link, its own names, its own week. Friends and private events reach past a
group only by invitation: nobody finds you without your link.

I also looked at what people use. When2meet gets everyone to paint a
grid, then stops at the overlap. Doodle starts from a few times one organiser
guesses at. Hangout starts from everyone's real week, and ends with a plan.

## What I chose not to build

- **Passwords and Google sign-in.** Writing straight into Google Calendar
  needs OAuth, which an unverified app only offers to listed test users.
  Links do the same job without the wall.
- **Chat, notifications, recurring availability.** The group chat already
  exists, and Hangout's job is to end it.

The cost of no passwords: whoever holds your sign-in link is you, so it's
private, and your profile can replace it.

## What's enforced, and what's judged

`spec/` enforces these, against the running app:
- a stranger with the link can join, and a profile can join in one tap
- your free hours come back after a cold server restart, and the group can
  see them
- the top recommendation is the longest shared stretch
- a proposal can be shortened
- calendar times are right across a daylight-saving change
- a friend request isn't a friendship until it's accepted
- a private event answers 403 to anyone not invited

The quality floor checks accessibility basics on every page state. Whether
the recommendations feel right, and whether Hangout really beats the group
chat, are judged: by people using it together.

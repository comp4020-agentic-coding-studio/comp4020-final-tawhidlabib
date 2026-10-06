# Crit 8: It's alive!

## What was the breakthrough that moved the work forward?

Letting go of "add it to my Google Calendar" as I first imagined it. I
pictured the event just appearing in everyone's calendar. That meant Google
sign-in, an OAuth app, and a list of approved test users. At the crit, my
pod are strangers opening a link on their own phones, so they would have
hit a wall before they ever saw a grid. An Add to Google Calendar link and
an `.ics` file give nearly all of the value with none of the setup. Once
calendar didn't need accounts, nothing else did either: a person could just
be a name and a cookie. That one decision collapsed three hard problems
into small ones, and it's why the whole flow could go live in a day.

## What did this work change about who I want to be as a software developer?

I want to be the developer who decides what not to build, and can say why.
Most of the decisions that made Hangout work were subtractions: no
accounts, no recurring schedules, no chat. Each one is written down with
what it costs. I also want to trust the artefact over my reading of the
code. Every test was green while the grid headers said "Tue," over "8", and
while the checks never looked at the page people actually use. Looking at
what really renders, and making the checks look too, is a habit I want to
keep.

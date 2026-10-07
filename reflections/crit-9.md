# Crit 9: All at once

## What was the breakthrough that moved the work forward?

Deciding that the live stream should carry almost nothing. My first picture
of real-time was the server pushing the new comment, the new hours, the new
guest list to everyone watching. That would have meant a second copy of
every access rule. Instead, the stream only says "this topic changed", and
each open page asks again through the rules it already uses. Private events
stayed private for free, the stream stayed tiny, and in production a change
reached another screen in 52 milliseconds.

It kept paying off. Every feature after it (the inbox, polls, photo albums,
the waitlist, group admin) became live by publishing one topic, not by
designing a new channel. Seven milestones shipped one after another on that
single decision.

## What did this work change about who I want to be as a software developer?

I want to decide how my software behaves under pressure before the
pressure arrives. "Two people tap the last spot at once" isn't an edge case
at a showcase with a room full of people; it's the main case. Choosing
first-come-first-served, and writing down that it's unfair to people who
are slow or offline, felt different from fixing a bug afterwards. I chose
who loses, on purpose, and can say why.

I also want to ship in small, finished pieces. Each milestone went red,
green, checked, then live, before the next began. The work stayed
deployable even as it tripled in size, and the commit history tells the
story without me having to.

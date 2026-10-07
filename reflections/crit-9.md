# Crit 9: All at once

## What was the breakthrough that moved the work forward?

Deciding that the live stream should carry almost nothing. My first picture
of real-time was the server pushing the new comment, the new hours, the new
guest list to everyone watching. That would have meant a second copy of
every access rule. Who's allowed to see a private event's guests? A
group's grid? Each rule would live once in the pages and again in the
pushes. Instead, the stream only says "this topic changed", and each open
page asks again through the same rules it always uses. One decision made
real-time safe for private events, kept the stream tiny, and meant every
existing page became live by marking the parts that change. It showed up in
production as 52 milliseconds from someone's save to another person's
screen.

## What did this work change about who I want to be as a software developer?

I want to decide how my software behaves under pressure before the
pressure arrives. "Two people tap the last spot at once" isn't an edge
case at a showcase with a room full of people; it's the main case. Picking
first-come-first-served, and writing down that it's unfair to people who
are slow or offline, felt different from fixing a bug afterwards. I chose
who loses, on purpose, and can say why. I'd rather defend a cost I chose
than discover one I didn't.

# Crit 10: Fly by instruments

## What was the breakthrough that moved the work forward?

Reading the app only through its log, the way the marker will. Two people
used it from separate browsers while I watched nothing but the activity
lines. It told them apart on every line, and every attempt one made on the
other's group or event came back denied. But one line read `Sam edited
event 9 → denied`, which anyone skimming would read as Sam editing it.
Every test passed, because the tests checked the database, not the
sentence. Now a refusal always reads "tried to".

That changed what "done" meant. A feature is finished when someone who
wasn't there can tell what happened from the log alone, without learning
a secret from it. The first logging pass failed the second half: it wrote
every group's invite link into every line.

## What did this work change about who I want to be as a software developer?

This round I directed a team: one lead agent reviewing, and fixers each
working in their own branch. Three times a fixer's work passed its own
tests and was still wrong. A migration would have deleted every RSVP in
production, and the fixer said it had checked. The lead rebuilt the old
database, ran the migration, and watched three RSVPs become zero. Another
reported the phone tab bar fixed; a measurement in Chrome found 96 pixels
still hidden.

I want to be the developer who keeps writing and reviewing apart, and who
treats "it passes" as a claim to check, not an answer. Delegating more
made checking matter more, not less.

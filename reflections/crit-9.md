# Crit 9: All at once

## What was the breakthrough that moved the work forward?

Deciding that the live stream should carry almost nothing. My first picture
of real-time was the server pushing the new comment, the new hours and the
new guest list to everyone watching. That would have meant writing every
privacy rule twice: once for the pages, once for the pushes. Instead the
stream only says "this changed", and each open page asks again through the
rules it already has. Private events stayed private without extra code, and
a change reached another screen in 52 milliseconds on the live site.

It kept paying off. Every feature after it, from the inbox to the waitlist
to the blind grid, went live by naming one topic, not by building a new
channel.

## What did this work change about who I want to be as a software developer?

I trusted green checks less, and that changed how I want to work. Three
times a test passed for the wrong reason. One couldn't fail because Chrome
merged the button presses it was meant to race. One passed because it
looked at the wrong week. One blamed the app for its own bug. Each time,
the fix wasn't to make it pass. It was to break the code on purpose, watch
the test go red for the right reason, then fix it.

I want to be a developer who asks "how would I know if this were wrong?"
before "does it pass?". The same goes for decisions. With the last spot at
a full event, I chose who loses and wrote it down. I'd rather defend a cost
I chose than discover one I didn't.

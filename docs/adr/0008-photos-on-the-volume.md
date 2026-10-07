# 8. Photos are uploaded, kept on the volume, and private to their plan

Date: 2026-10-07 · Status: accepted

## Context

"After the hangout" gives every plan whose day has come a shared album, and
profiles can have a photo avatar. Photos need to live somewhere, and the
course setup gives one 1 GB volume and no other storage.

## Options

- **Upload to the app.** Files are stored beside the database on the volume,
  served by the app itself with the same access rules as the plan.
- **Emoji avatars and pasted photo links.** No storage at all, but links
  break, people need somewhere else to host photos, and Hangout can't
  control who sees them.

## Decision

Uploads (`src/lib/media.ts`):
- **Real images only.** A file is accepted only if its first bytes say JPEG,
  PNG or WebP. Its name and the type the browser claims are ignored, so a
  script renamed `.png` is refused (415).
- **Up to 5 MB each** (413 above that), and up to 10 at a time in an album.
- **Random names**, and only names of that shape are ever read back, so a
  path can't be smuggled in.

Two routes serve the same folder by different rules:
- **`/media/<file>`** serves album photos only to the people the plan is
  for (403 otherwise), privately cached.
- **`/avatars/<file>`** serves a file publicly *only if it really is
  someone's avatar*, so an album photo can never be fetched through it.

Albums open on the plan's day, in its own timezone. Uploaders, and an
event's host, can take photos down.

## What it costs

Photos are stored at the size they're uploaded. There's no resizing,
because an image library is a heavy native dependency for a 256 MB machine.
So albums of phone photos fill the volume faster than they need to, and
load slower on a phone. The volume isn't backed up; losing it loses the
photos with the database. Moving photos to object storage would need a
second service outside the course setup.

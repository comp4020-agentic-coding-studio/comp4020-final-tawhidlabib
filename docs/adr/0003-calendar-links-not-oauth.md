# 3. Calendar links, not the Google Calendar API

Date: 2026-10-06 · Status: accepted (crit 8)

## Context

My idea was that agreeing to a hangout adds it to your Google Calendar.
Writing an event into someone's calendar through the API needs Google
sign-in with a calendar scope, which contradicts
[ADR 2](0002-invite-link-identity.md). An unverified app can also only be
used by listed test users, so my pod would hit a wall at the crit.

## Options

- **The Calendar API with OAuth.** The event appears without a click. But it
  needs Google Cloud setup, sign-in for everyone, and verification before
  strangers can use it.
- **An Add to Google Calendar link plus an `.ics` file.** One click opens a
  pre-filled event in Google Calendar, and the `.ics` covers Apple, Outlook
  and the rest. No sign-in.
- **No calendar at all for crit 8.** Safer, but it drops the step that makes
  a plan real.

## Decision

Links. Once you say you're in, you get both. Times go out as UTC instants,
converted from the group's timezone, so neither format depends on the
calendar guessing the zone. A test pins the conversion either side of
Sydney's daylight-saving change.

## What it costs

You have to click to save the event, and if a hangout changes, your
calendar doesn't follow it. The `.ics` is members-only. The Google link
carries the hangout's details in its URL to whoever it's shared with.

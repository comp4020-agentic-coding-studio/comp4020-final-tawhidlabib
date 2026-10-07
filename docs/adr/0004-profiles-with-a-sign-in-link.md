# 4. A person is a profile with a private sign-in link

Date: 2026-10-07 · Status: accepted · Supersedes [ADR 2](0002-invite-link-identity.md)

## Context

ADR 2 made a person a name and a cookie inside each group. That was enough
for one group's week. But friends, a personal calendar and event invites
all need someone who exists across groups. ADR 2's own cost, losing
yourself when you lose the cookie, had also become real.

## Options

- **A profile with no password.** You pick a name once and a cookie
  remembers it. The profile's secret token doubles as a private sign-in link
  for your other devices.
- **Email and password accounts.** Familiar, but they bring resets,
  verification and friction on the invite link, which is the one thing
  Hangout can't afford.
- **Google sign-in.** One tap, but OAuth, and an unverified app only works
  for listed test users ([ADR 3](0003-calendar-links-not-oauth.md)).

## Decision

A profile (`people`), in an `hp` cookie, whose token is also the sign-in
link `/me/sign-in/<token>`.

- Starting or joining a group makes the profile from the name you type, so
  nobody signs up twice. Someone who already has one joins in one tap.
- Group memberships gain a `person_id`. Old ones are claimed the first time
  their owner makes a profile in the same browser.
- The sign-in link's page only *asks*. A button POSTs, so a chat app's link
  preview can't sign anyone in.
- Your profile can make a new link, which signs out every other device.
- Friend codes are separate from tokens. Your friend link can be shared
  freely, and it never signs anyone in as you.

## What it costs

Whoever holds your sign-in link is you. There's no second factor and no
recovery if you lose every device and the link. Names aren't unique, so
"Ana" could be two people; friends tell them apart by how they met. Per-group
cookies still exist alongside profiles, so a browser can know you two ways.
`currentMember()` resolves that by trusting the group cookie first.

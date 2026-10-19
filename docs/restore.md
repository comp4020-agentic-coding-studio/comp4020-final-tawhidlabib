# Restoring the volume from a snapshot

Everything Hangout knows lives on one Fly volume mounted at `/data`. That's
the SQLite file (`app.db`) and the uploaded photos (`uploads/`). Fly takes
scheduled snapshots of it and keeps each one for 5 days. `flyctl volumes
create --help` shows both as defaults; how often they're taken is
**unverified** here (Fly's docs say daily). This is how to get a day back.

A restore never writes over the volume you have. It makes a **new** volume
from the snapshot and a new machine on top of it. The old volume and
machine stay until you're sure, so you can always go back.

Commands are written for this app. `APP` is `comp4020-final-tawhidlabib`,
and the token comes from `mise.local.toml`, as for deploys. Every command
and flag below was checked against `flyctl --help` (flyctl v0.4.112, 19 Oct
2026). What `--help` can't show is marked **unverified**. None of it has
been run against the live app.

## 0. Before you start

- Decide which day you want back. Anything written after that snapshot is
  lost on the restored copy: groups, hours, photos, the activity log.
- `mise exec -- flyctl logs --no-tail -a APP` shows the latest `[activity]` lines,
  if you need to judge what you'd lose. (`scripts/activity.ts` isn't in
  the image: the Dockerfile copies only `dist`, `node_modules` and
  `drizzle`.)
- Want an extra safety copy of the state right now? Snapshot it first:

  ```sh
  mise exec -- flyctl volumes snapshots create <volume id> -a APP
  ```

## 1. Find the volume, and its snapshots

```sh
mise exec -- flyctl volumes list -a APP
mise exec -- flyctl volumes snapshots list <volume id> -a APP
```

The first gives the volume's id (`vol_...`), its name (`data`) and the
machine it's attached to. The second lists that volume's snapshots, each
with an id and the time it was taken. Pick the last one from before things
went wrong.

## 2. Make a new volume from the snapshot

```sh
mise exec -- flyctl volumes create data --snapshot-id <snapshot id> -r syd -s 1 -a APP
```

`data` is the name `fly.toml` mounts, `syd` its region, and `1` its size in
GB. It prints the new volume's id. Write it down.

## 3. Put a machine on it

```sh
mise exec -- flyctl machine list -a APP
mise exec -- flyctl machine clone <old machine id> --attach-volume <new volume id>:/data -a APP
```

The clone is a copy of the running machine, with the same image, settings
and health check, but attached to the restored volume. On boot it runs any
migrations the snapshot is behind on, as a deploy would (`src/lib/db.ts`).

## 4. Check it, then retire the old one

Open the app and look for something you know was there on the snapshot's
day. `/api/health` should say `ok`. While both machines run, Fly's proxy
sends requests to either one, so stop the old machine quickly:

```sh
mise exec -- flyctl machine stop <old machine id> -a APP
```

Once you're sure, destroy the old machine. The old volume can go later, and
when it does its data is gone for good:

```sh
mise exec -- flyctl machine destroy <old machine id> -a APP
mise exec -- flyctl volumes destroy <old volume id> -a APP     # only when certain
```

## 5. The next deploy

**Unverified** (not something `--help` can show): `flyctl deploy` should
update the remaining machine in place and keep the volume it's attached
to, now the restored one. Until the old volume is destroyed there are two
volumes named `data`. So check `flyctl volumes list -a APP` after the first
deploy, and see that the machine still shows the restored volume.

## What a restore doesn't bring back

- Live connections. Open pages reconnect to the new machine on their own
  (the stream retries every 3 s).
- Anything only in the logs. `flyctl logs` lines aren't on the volume,
  though the `activity` table is, up to the snapshot.

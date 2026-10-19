# syntax = docker/dockerfile:1

# The image Fly builds and runs: install, build, then keep only the built
# server and its production dependencies. It serves HTTP on 0.0.0.0:$PORT
# (fly.toml sets PORT) and publishes README.md at /readme/ (spec/README.md
# says what's checked).

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Astro"

WORKDIR /app
ENV NODE_ENV=production

ARG PNPM_VERSION=11.9.0
RUN npm install -g pnpm@$PNPM_VERSION

# --- build stage: install everything, build, then prune to prod deps -------
FROM base AS build

# toolchain for native modules (better-sqlite3), in case no prebuilt binary
# matches the image platform. sharp (photos, src/lib/media.ts) needs none:
# installing here, on Linux, picks its prebuilt @img/sharp-linux-<arch>
# package with libvips inside, which wants glibc >= 2.28 (slim is bookworm,
# 2.36). That's why node_modules is never copied in from a Mac.
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm run build
RUN pnpm prune --prod

# --- runtime stage: just the built server and its production deps ----------
FROM base

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
# the committed migrations, applied at boot (see src/lib/db.ts)
COPY --from=build /app/drizzle /app/drizzle

# the SQLite file lives on the volume, so state survives reloads, restarts,
# and redeploys
#
# This stage runs as root, on purpose for now. Fly mounts the volume at
# /data owned by root, and the app has to write app.db, its WAL and
# uploads/ there. Running as the image's `node` user would need /data
# chown'd at every start (a small root entrypoint, then dropping to node),
# and a mistake there stops every write with no error until someone saves.
# That change wasn't made because it couldn't be checked against a real
# volume here (no Docker running when it was considered, 19 Oct 2026).
# Before making it: build, run with `-v` on a root-owned dir at /data, and
# check that a group saves and a photo uploads.
ENV DATABASE_PATH=/data/app.db
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080
CMD ["node", "./dist/server/entry.mjs"]

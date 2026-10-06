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
# matches the image platform
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
# once there are migrations in drizzle/ to apply at boot, copy them too:
# COPY --from=build /app/drizzle /app/drizzle

# the SQLite file lives on the volume, so state survives reloads, restarts,
# and redeploys
ENV DATABASE_PATH=/data/app.db
ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080
CMD ["node", "./dist/server/entry.mjs"]

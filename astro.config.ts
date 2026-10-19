import node from "@astrojs/node";
import { defineConfig } from "astro/config";

// Server-rendered output: pages render per request so they can read the
// database, and `astro build` emits the Node server the Dockerfile runs.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  // 8080 everywhere --- dev, preview and the built server --- because that's
  // where fly.toml points and where `pnpm check` looks by default (APP_URL).
  // In production PORT and HOST come from the environment.
  server: { port: 8080 },
  security: {
    // Fly's proxy terminates TLS, so naming the deploy domain is what lets
    // Astro trust x-forwarded-proto and accept same-origin form POSTs.
    // Since Astro 7.4 a Host not named here is replaced with localhost, so a
    // server reached as 127.0.0.1 (spec/crit-8 and spec/migrations boot one
    // there) would refuse its own forms: name both local hosts too.
    allowedDomains: [
      { hostname: "**.fly.dev", protocol: "https" },
      { hostname: "localhost", protocol: "http" },
      { hostname: "127.0.0.1", protocol: "http" },
    ],
  },
});

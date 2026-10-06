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
    allowedDomains: [{ hostname: "**.fly.dev", protocol: "https" }],
  },
});

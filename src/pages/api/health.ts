import type { APIRoute } from "astro";
import { healthy } from "../../lib/db";

/** Fly's health check (fly.toml): 200 "ok" once the database answers a
 *  query, 503 if it doesn't. Says nothing else, to anyone. */
export const GET: APIRoute = () => {
  const ok = healthy();
  return new Response(ok ? "ok" : "database unavailable", {
    status: ok ? 200 : 503,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
};

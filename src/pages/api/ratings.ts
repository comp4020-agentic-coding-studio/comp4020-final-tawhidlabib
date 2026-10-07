import type { APIRoute } from "astro";
import { publish } from "../../lib/live";
import { rate, SCORES } from "../../lib/memories";
import { openThread } from "../../lib/talk";

/** How was it? One rating each, once the plan's day has come. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const thread = openThread(String(form.get("kind") ?? ""), String(form.get("ref") ?? ""), cookies);
  if (!thread) return new Response("No such plan", { status: 404 });
  if (!thread.visible) return new Response("This plan isn't yours", { status: 403 });
  if (!thread.person) return redirect(thread.page, 303);
  if (!thread.arrived) return new Response("Ratings open on the day", { status: 409 });

  const score = Number(form.get("score"));
  if (!SCORES.some((s) => s.score === score)) return new Response("Rate 1 to 5", { status: 400 });
  rate(thread.target, thread.person.id, score);
  publish(`thread:${thread.kind}:${thread.ref}`, "rating");
  return redirect(thread.page, 303);
};

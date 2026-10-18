import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse, threadTarget } from "../../lib/activity";
import { publish } from "../../lib/live";
import { rate, SCORES } from "../../lib/memories";
import { openThread } from "../../lib/talk";

/** How was it? One rating each, once the plan's day has come. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const thread = openThread(String(form.get("kind") ?? ""), String(form.get("ref") ?? ""), cookies);
  if (!thread) return refuse(cookies, "rated", threadTarget(thread, form.get("kind")), "not found", 404, "No such plan");
  if (!thread.visible) return refuse(cookies, "rated", threadTarget(thread, ""), "not your plan", 403, "This plan isn't yours");
  if (!thread.person) return redirect(thread.page, 303);
  if (!thread.arrived) return refuse(cookies, "rated", threadTarget(thread, ""), "not the day yet", 409, "Ratings open on the day");

  const score = Number(form.get("score"));
  if (!SCORES.some((s) => s.score === score)) return new Response("Rate 1 to 5", { status: 400 });
  rate(thread.target, thread.person.id, score);
  logActivity({ who: personLabel(thread.person), action: "rated", target: threadTarget(thread, ""), outcome: "ok", detail: `${score}/5` });
  publish(`thread:${thread.kind}:${thread.ref}`, "rating");
  return redirect(thread.page, 303);
};

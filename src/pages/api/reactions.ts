import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse, threadTarget } from "../../lib/activity";
import { publish } from "../../lib/live";
import { isReaction, openThread, react } from "../../lib/talk";

/** React to a plan: one reaction each, and the same again takes it back. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const thread = openThread(String(form.get("kind") ?? ""), String(form.get("ref") ?? ""), cookies);
  if (!thread) return refuse(cookies, "reacted to", threadTarget(thread, form.get("kind")), "not found", 404, "No such plan");
  if (!thread.visible) return refuse(cookies, "reacted to", threadTarget(thread, ""), "not your plan", 403, "This plan isn't yours to react to");
  if (!thread.person) return redirect(thread.page, 303);
  if (!thread.canTalk) return refuse(cookies, "reacted to", threadTarget(thread, ""), "read-only", 409, "This plan can be read, not added to");

  const emoji = form.get("emoji");
  if (!isReaction(emoji)) return new Response("Not a reaction", { status: 400 });
  react(thread.target, thread.person.id, String(emoji));
  logActivity({ who: personLabel(thread.person), action: "reacted to", target: threadTarget(thread, ""), outcome: "ok", detail: String(emoji) });
  publish(`thread:${thread.kind}:${thread.ref}`);
  return redirect(thread.page, 303);
};

import type { APIRoute } from "astro";
import { publish } from "../../lib/live";
import { isReaction, openThread, react } from "../../lib/talk";

/** React to a plan: one reaction each, and the same again takes it back. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const thread = openThread(String(form.get("kind") ?? ""), String(form.get("ref") ?? ""), cookies);
  if (!thread) return new Response("No such plan", { status: 404 });
  if (!thread.visible) return new Response("This plan isn't yours to react to", { status: 403 });
  if (!thread.person) return redirect(thread.page, 303);

  const emoji = form.get("emoji");
  if (!isReaction(emoji)) return new Response("Not a reaction", { status: 400 });
  react(thread.target, thread.person.id, String(emoji));
  publish(`thread:${thread.kind}:${thread.ref}`);
  return redirect(thread.page, 303);
};

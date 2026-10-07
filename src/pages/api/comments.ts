import type { APIRoute } from "astro";
import { addComment, openThread } from "../../lib/talk";

/** Say something on a plan's thread. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const thread = openThread(String(form.get("kind") ?? ""), String(form.get("ref") ?? ""), cookies);
  if (!thread) return new Response("No such plan", { status: 404 });
  if (!thread.visible) return new Response("This plan isn't yours to talk about", { status: 403 });
  if (!thread.person) return redirect(thread.page, 303);

  const body = String(form.get("body") ?? "").trim().slice(0, 500);
  if (body) addComment(thread.target, thread.person.id, body);
  return redirect(thread.page, 303);
};

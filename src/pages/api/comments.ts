import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse, threadTarget } from "../../lib/activity";
import { publish } from "../../lib/live";
import { notify, snippet } from "../../lib/notify";
import { addComment, openThread } from "../../lib/talk";

/** Say something on a plan's thread. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const thread = openThread(String(form.get("kind") ?? ""), String(form.get("ref") ?? ""), cookies);
  if (!thread) return refuse(cookies, "commented on", threadTarget(thread, form.get("kind")), "not found", 404, "No such plan");
  if (!thread.visible) return refuse(cookies, "commented on", threadTarget(thread, ""), "not your plan", 403, "This plan isn't yours to talk about");
  if (!thread.person) return redirect(thread.page, 303);
  if (!thread.canTalk) return refuse(cookies, "commented on", threadTarget(thread, ""), "read-only", 409, "This plan can be read, not added to");

  const body = String(form.get("body") ?? "").trim().slice(0, 500);
  if (body) {
    addComment(thread.target, thread.person.id, body);
    logActivity({ who: personLabel(thread.person), action: "commented on", target: threadTarget(thread, ""), outcome: "ok", detail: `${body.length} chars` });
    notify(thread.audience(), {
      kind: "comment",
      text: `${thread.person.name} commented on ${thread.title}: ${snippet(body)}`,
      href: thread.page,
      actorId: thread.person.id,
      groupId: thread.groupId,
    });
  }
  publish(`thread:${thread.kind}:${thread.ref}`);
  return redirect(thread.page, 303);
};

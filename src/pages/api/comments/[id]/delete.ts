import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse } from "../../../../lib/activity";
import { getHangout } from "../../../../lib/db";
import { eventById } from "../../../../lib/events";
import { publish } from "../../../../lib/live";
import { commentById, deleteComment, openThread } from "../../../../lib/talk";

/** Take a comment back: its author can, and so can an event's host. */
export const POST: APIRoute = ({ params, cookies, redirect }) => {
  const comment = commentById(Number(params.id));
  if (!comment) return refuse(cookies, "deleted comment", `comment ${params.id}`, "not found", 404, "No such comment");
  const thread =
    comment.eventId !== null
      ? openThread("event", eventById(comment.eventId)?.shareId ?? "", cookies)
      : openThread("hangout", String(getHangout(comment.hangoutId ?? 0)?.id ?? ""), cookies);
  const me = thread?.person;
  if (!thread || !me || (me.id !== comment.authorId && me.id !== thread.moderatorId)) {
    return refuse(cookies, "deleted comment", `comment ${comment.id}`, "not its author", 403, "Only its author can delete a comment");
  }
  deleteComment(comment.id);
  logActivity({ who: personLabel(me), action: "deleted comment", target: `comment ${comment.id} on ${thread.kind} ${thread.target.id}`, outcome: "ok" });
  publish(`thread:${thread.kind}:${thread.ref}`);
  return redirect(thread.page, 303);
};

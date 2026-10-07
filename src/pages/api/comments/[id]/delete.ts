import type { APIRoute } from "astro";
import { getHangout } from "../../../../lib/db";
import { eventById } from "../../../../lib/events";
import { publish } from "../../../../lib/live";
import { commentById, deleteComment, openThread } from "../../../../lib/talk";

/** Take a comment back: its author can, and so can an event's host. */
export const POST: APIRoute = ({ params, cookies, redirect }) => {
  const comment = commentById(Number(params.id));
  if (!comment) return new Response("No such comment", { status: 404 });
  const thread =
    comment.eventId !== null
      ? openThread("event", eventById(comment.eventId)?.shareId ?? "", cookies)
      : openThread("hangout", String(getHangout(comment.hangoutId ?? 0)?.id ?? ""), cookies);
  const me = thread?.person;
  if (!thread || !me || (me.id !== comment.authorId && me.id !== thread.moderatorId)) {
    return new Response("Only its author can delete a comment", { status: 403 });
  }
  deleteComment(comment.id);
  publish(`thread:${thread.kind}:${thread.ref}`);
  return redirect(thread.page, 303);
};

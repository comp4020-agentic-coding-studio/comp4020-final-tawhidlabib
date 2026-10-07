import type { APIRoute } from "astro";
import { publish } from "../../../../lib/live";
import { closePoll, pollById, pollTarget } from "../../../../lib/polls";
import { threadFor } from "../../../../lib/talk";

/** Whoever asked closes the poll; the votes stay to read. */
export const POST: APIRoute = ({ params, cookies, redirect }) => {
  const poll = pollById(Number(params.id));
  if (!poll) return new Response("No such poll", { status: 404 });
  const thread = threadFor(pollTarget(poll), cookies);
  if (!thread?.person || thread.person.id !== poll.createdBy) {
    return new Response("Only whoever asked can close a poll", { status: 403 });
  }
  closePoll(poll.id);
  publish(`thread:${thread.kind}:${thread.ref}`, "poll");
  return redirect(thread.page, 303);
};

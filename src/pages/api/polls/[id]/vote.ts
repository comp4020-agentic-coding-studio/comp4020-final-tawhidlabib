import type { APIRoute } from "astro";
import { publish } from "../../../../lib/live";
import { pollById, pollTarget, vote } from "../../../../lib/polls";
import { threadFor } from "../../../../lib/talk";

/** Vote on a poll, as one of the plan's people, while it's open. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const poll = pollById(Number(params.id));
  if (!poll) return new Response("No such poll", { status: 404 });
  const thread = threadFor(pollTarget(poll), cookies);
  if (!thread?.visible) return new Response("This plan isn't yours to vote on", { status: 403 });
  if (!thread.person) return redirect(thread.page, 303);
  if (poll.closedAt) return new Response("This poll is closed", { status: 409 });

  vote(poll.id, Number((await request.formData()).get("option")), thread.person.id, poll.multi);
  publish(`thread:${thread.kind}:${thread.ref}`, "poll");
  return redirect(thread.page, 303);
};

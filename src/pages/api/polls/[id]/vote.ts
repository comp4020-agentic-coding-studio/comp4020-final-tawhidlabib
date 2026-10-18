import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse } from "../../../../lib/activity";
import { publish } from "../../../../lib/live";
import { pollById, pollTarget, vote } from "../../../../lib/polls";
import { threadFor } from "../../../../lib/talk";

/** Vote on a poll, as one of the plan's people, while it's open. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const poll = pollById(Number(params.id));
  if (!poll) return refuse(cookies, "voted on poll", `poll ${params.id}`, "not found", 404, "No such poll");
  const thread = threadFor(pollTarget(poll), cookies);
  if (!thread?.visible) return refuse(cookies, "voted on poll", `poll ${poll.id}`, "not your plan", 403, "This plan isn't yours to vote on");
  if (!thread.person) return redirect(thread.page, 303);
  if (!thread.canTalk) return refuse(cookies, "voted on poll", `poll ${poll.id}`, "read-only", 409, "This plan can be read, not added to");
  if (poll.closedAt) return refuse(cookies, "voted on poll", `poll ${poll.id}`, "poll closed", 409, "This poll is closed");

  vote(poll.id, Number((await request.formData()).get("option")), thread.person.id, poll.multi);
  logActivity({ who: personLabel(thread.person), action: "voted on poll", target: `poll ${poll.id}`, outcome: "ok" });
  publish(`thread:${thread.kind}:${thread.ref}`, "poll");
  return redirect(thread.page, 303);
};

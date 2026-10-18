import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse } from "../../../../lib/activity";
import { publish } from "../../../../lib/live";
import { closePoll, pollById, pollTarget } from "../../../../lib/polls";
import { threadFor } from "../../../../lib/talk";

/** Whoever asked closes the poll; the votes stay to read. */
export const POST: APIRoute = ({ params, cookies, redirect }) => {
  const poll = pollById(Number(params.id));
  if (!poll) return refuse(cookies, "closed poll", `poll ${params.id}`, "not found", 404, "No such poll");
  const thread = threadFor(pollTarget(poll), cookies);
  if (!thread?.person || thread.person.id !== poll.createdBy) {
    return refuse(cookies, "closed poll", `poll ${poll.id}`, "not its author", 403, "Only whoever asked can close a poll");
  }
  closePoll(poll.id);
  logActivity({ who: personLabel(thread.person), action: "closed poll", target: `poll ${poll.id}`, outcome: "ok" });
  publish(`thread:${thread.kind}:${thread.ref}`, "poll");
  return redirect(thread.page, 303);
};

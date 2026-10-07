import type { APIRoute } from "astro";
import { field } from "../../lib/forms";
import { publish } from "../../lib/live";
import { notify } from "../../lib/notify";
import { createPoll, MAX_OPTIONS } from "../../lib/polls";
import { openThread } from "../../lib/talk";

/** Ask a question on a plan: two to six options, single or multiple choice.
 *  The plan's people are told. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const thread = openThread(String(form.get("kind") ?? ""), String(form.get("ref") ?? ""), cookies);
  if (!thread) return new Response("No such plan", { status: 404 });
  if (!thread.visible) return new Response("This plan isn't yours to ask about", { status: 403 });
  if (!thread.person) return redirect(thread.page, 303);

  const question = field(form.get("question"), 120);
  const options = [...new Set(form.getAll("option").map((o) => field(o, 60)).filter(Boolean))].slice(0, MAX_OPTIONS);
  if (!question || options.length < 2) return redirect(thread.page, 303);

  createPoll(thread.target, thread.person.id, question, options, form.has("multi"));
  publish(`thread:${thread.kind}:${thread.ref}`, "poll");
  notify(thread.audience(), {
    kind: "poll",
    text: `${thread.person.name} asked on ${thread.title}: ${question}`,
    href: thread.page,
    actorId: thread.person.id,
  });
  return redirect(thread.page, 303);
};

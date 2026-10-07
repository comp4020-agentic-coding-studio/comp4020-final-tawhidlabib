import type { APIRoute } from "astro";
import { getHangout, setRsvp } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { publish } from "../../../../lib/live";
import { currentMember } from "../../../../lib/identity";
import { weekStartOf } from "../../../../lib/time";

/** I'm in, or I can't make it. Answering again changes your answer. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const hangout = getHangout(Number(params.id));
  if (!hangout) return new Response("No such hangout", { status: 404 });
  const me = currentMember(cookies, hangout.groupId);
  if (!me) return new Response("Join the group first", { status: 403 });

  const response = String((await request.formData()).get("response") ?? "");
  if (response !== "in" && response !== "out") {
    return new Response("Answer in or out", { status: 400 });
  }

  setRsvp(hangout.id, me.id, response);
  publish(`group:${hangout.groupId}`, "plans");
  flash(cookies, response);
  return redirect(`/g/${hangout.groupId}?week=${weekStartOf(hangout.date)}#plans`, 303);
};

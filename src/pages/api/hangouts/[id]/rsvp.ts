import type { APIRoute } from "astro";
import { groupRef, logActivity, refuse, whoIs } from "../../../../lib/activity";
import { getGroup, getHangout, setRsvp } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { publish } from "../../../../lib/live";
import { currentMember } from "../../../../lib/identity";
import { isArchived } from "../../../../lib/manage";
import { weekStartOf } from "../../../../lib/time";

/** I'm in, or I can't make it. Answering again changes your answer. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const hangout = getHangout(Number(params.id));
  if (!hangout) return refuse(cookies, "answered hangout", `hangout ${params.id}`, "not found", 404, "No such hangout");
  const group = getGroup(hangout.groupId);
  const target = `hangout ${hangout.id} in ${groupRef(group ?? hangout.groupId)}`;
  const me = currentMember(cookies, hangout.groupId);
  if (!me) return refuse(cookies, "answered hangout", target, "not a member", 403, "Join the group first", hangout.groupId);
  if (group && isArchived(group)) return refuse(cookies, "answered hangout", target, "group archived", 409, "This group is archived", hangout.groupId);

  const response = String((await request.formData()).get("response") ?? "");
  if (response !== "in" && response !== "out") {
    return new Response("Answer in or out", { status: 400 });
  }

  setRsvp(hangout.id, me.id, response);
  logActivity({ who: whoIs(cookies, hangout.groupId), action: response === "in" ? "said in to" : "said out of", target, outcome: "ok" });
  publish(`group:${hangout.groupId}`, "plans");
  flash(cookies, response);
  return redirect(`/g/${hangout.groupId}?week=${weekStartOf(hangout.date)}#plans`, 303);
};

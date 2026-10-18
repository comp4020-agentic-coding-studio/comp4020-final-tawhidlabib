import type { APIRoute } from "astro";
import { groupRef, logActivity, refuse, whoIs } from "../../../../lib/activity";
import { setMuted } from "../../../../lib/blocks";
import { getGroup } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { currentMember } from "../../../../lib/identity";

/** Mute or unmute a group's notifications, for yourself. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return refuse(cookies, "muted", groupRef(params.id), "not found", 404, "No such group");
  const me = currentMember(cookies, group.id);
  if (!me) return refuse(cookies, "muted", groupRef(group), "not a member", 403, "Join the group first", group.id);
  const muted = (await request.formData()).get("muted") === "1";
  setMuted(me.id, muted);
  logActivity({ who: whoIs(cookies, group.id), action: muted ? "muted" : "unmuted", target: groupRef(group), outcome: "ok" });
  flash(cookies, muted ? "muted" : "unmuted");
  return redirect(`/g/${group.id}#people`, 303);
};

import type { APIRoute } from "astro";
import { setMuted } from "../../../../lib/blocks";
import { getGroup } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { currentMember } from "../../../../lib/identity";

/** Mute or unmute a group's notifications, for yourself. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return new Response("No such group", { status: 404 });
  const me = currentMember(cookies, group.id);
  if (!me) return new Response("Join the group first", { status: 403 });
  const muted = (await request.formData()).get("muted") === "1";
  setMuted(me.id, muted);
  flash(cookies, muted ? "muted" : "unmuted");
  return redirect(`/g/${group.id}#people`, 303);
};

import type { APIRoute } from "astro";
import { getGroup } from "../../../../lib/db";
import { flash } from "../../../../lib/flash";
import { field } from "../../../../lib/forms";
import { currentMember } from "../../../../lib/identity";
import { publish } from "../../../../lib/live";
import {
  isAdmin,
  leaveGroup,
  memberById,
  removeMember,
  renameGroup,
  setAdmin,
  setArchived,
} from "../../../../lib/manage";
import { notify } from "../../../../lib/notify";

/** Run a group. Anyone can leave; everything else is the admin's: rename,
 *  hand over admin, remove someone, archive or unarchive. */
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return new Response("No such group", { status: 404 });
  const me = currentMember(cookies, group.id);
  if (!me) return new Response("Join the group first", { status: 403 });

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const page = `/g/${group.id}#people`;

  if (action === "leave") {
    leaveGroup(group, me);
    publish(`group:${group.id}`, "people");
    flash(cookies, "left");
    return redirect("/groups", 303);
  }

  if (!isAdmin(group, me)) return new Response("Only the group's admin can do that", { status: 403 });

  if (action === "rename") {
    const name = field(form.get("name"), 60);
    if (name) renameGroup(group.id, name);
    flash(cookies, "groupRenamed");
  } else if (action === "admin" || action === "remove") {
    const them = memberById(group.id, Number(form.get("member")));
    if (!them || them.id === me.id) return redirect(page, 303);
    if (action === "admin") {
      setAdmin(group.id, them.id);
      if (them.personId) {
        notify([them.personId], { kind: "group", text: `You're now the admin of ${group.name}`, href: page, actorId: me.personId });
      }
      flash(cookies, "adminChanged");
    } else {
      removeMember(group.id, them);
      if (them.personId) {
        notify([them.personId], { kind: "group", text: `You were removed from ${group.name}`, href: "/groups", actorId: me.personId });
      }
      flash(cookies, "memberRemoved");
    }
  } else if (action === "archive" || action === "unarchive") {
    setArchived(group.id, action === "archive");
    flash(cookies, action === "archive" ? "archived" : "unarchived");
  } else {
    return new Response("Unknown action", { status: 400 });
  }

  publish(`group:${group.id}`, "group");
  return redirect(page, 303);
};

import type { APIRoute } from "astro";
import { logActivity, refuse, whoIs } from "../../../../lib/activity";
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
  if (!group) return refuse(cookies, "tried to manage", `group ${params.id}`, "not found", 404, "No such group");
  const me = currentMember(cookies, group.id);
  if (!me) return refuse(cookies, "tried to manage", `group ${group.id}`, "not a member", 403, "Join the group first", group.id);

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const page = `/g/${group.id}#people`;

  if (action === "leave") {
    leaveGroup(group, me);
    logActivity({ who: whoIs(cookies, group.id), action: "left", target: `group ${group.id}`, outcome: "ok" });
    publish(`group:${group.id}`, "people");
    flash(cookies, "left");
    return redirect("/groups", 303);
  }

  if (!isAdmin(group, me)) return refuse(cookies, `tried to ${action}`, `group ${group.id}`, "not the admin", 403, "Only the group's admin can do that", group.id);

  if (action === "rename") {
    const name = field(form.get("name"), 60);
    if (name) renameGroup(group.id, name);
    logActivity({ who: whoIs(cookies, group.id), action: "renamed", target: `group ${group.id}`, outcome: "ok", detail: `to "${name}"` });
    flash(cookies, "groupRenamed");
  } else if (action === "admin" || action === "remove") {
    const them = memberById(group.id, Number(form.get("member")));
    if (!them || them.id === me.id) return redirect(page, 303);
    if (action === "admin") {
      setAdmin(group.id, them.id);
      logActivity({ who: whoIs(cookies, group.id), action: "made admin", target: `m${them.id} "${them.name}" in group ${group.id}`, outcome: "ok" });
      if (them.personId) {
        notify([them.personId], { kind: "group", text: `You're now the admin of ${group.name}`, href: page, actorId: me.personId });
      }
      flash(cookies, "adminChanged");
    } else {
      removeMember(group.id, them);
      logActivity({ who: whoIs(cookies, group.id), action: "removed member", target: `m${them.id} "${them.name}" from group ${group.id}`, outcome: "ok" });
      if (them.personId) {
        notify([them.personId], { kind: "group", text: `You were removed from ${group.name}`, href: "/groups", actorId: me.personId });
      }
      flash(cookies, "memberRemoved");
    }
  } else if (action === "archive" || action === "unarchive") {
    setArchived(group.id, action === "archive");
    logActivity({ who: whoIs(cookies, group.id), action: `${action}d`, target: `group ${group.id}`, outcome: "ok" });
    flash(cookies, action === "archive" ? "archived" : "unarchived");
  } else {
    return new Response("Unknown action", { status: 400 });
  }

  publish(`group:${group.id}`, "group");
  return redirect(page, 303);
};

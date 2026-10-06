import type { APIRoute } from "astro";
import { addMember, getGroup } from "../../../../lib/db";
import { field } from "../../../../lib/forms";
import { remember } from "../../../../lib/identity";

/** Join a group from its invite link, under a name nobody in it has yet. */
export const POST: APIRoute = async ({ params, request, cookies, redirect, url }) => {
  const group = getGroup(params.id ?? "");
  if (!group) return new Response("No such group", { status: 404 });

  const name = field((await request.formData()).get("name"), 40);
  if (!name) return redirect(`/g/${group.id}?error=name-missing`, 303);

  const member = addMember(group.id, name);
  if (!member) return redirect(`/g/${group.id}?error=name-taken`, 303);

  remember(cookies, url, group.id, member.token);
  return redirect(`/g/${group.id}`, 303);
};

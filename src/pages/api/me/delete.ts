import type { APIRoute } from "astro";
import { eventRef, groupRef, logActivity } from "../../../lib/activity";
import { currentPerson } from "../../../lib/identity";
import { publish } from "../../../lib/live";
import { deleteImage } from "../../../lib/media";
import { notify } from "../../../lib/notify";
import { deletePerson } from "../../../lib/people";

/** Delete your profile, for good (ADR 4). /me asks first. deletePerson()
 *  does it in one transaction; this tidies up after: the files, every page
 *  that showed you, the guests of events you hosted, and anyone a spot you
 *  held went to. The log names you by number only, as you're gone. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/me", 303);
  const form = await request.formData();
  if (form.get("confirm") !== "delete") return redirect("/me", 303);

  const who = `p${me.id}`;
  const gone = deletePerson(me.id);
  for (const file of gone.files) await deleteImage(file);

  logActivity({
    who,
    action: "deleted their profile",
    target: who,
    outcome: "ok",
    detail: `${gone.files.length} files, ${gone.cancelled.length} hosted events`,
  });
  for (const { group, outcome } of gone.groups) {
    logActivity({ who, action: "left", target: groupRef(group), outcome: "ok", detail: outcome === "gone" ? "last member: group deleted" : "deleted their profile" });
  }
  for (const topic of gone.topics) publish(topic, "people");
  for (const { event, guests } of gone.cancelled) {
    logActivity({ who, action: "cancelled", target: eventRef(event), outcome: "ok", detail: "host deleted their profile" });
    publish(`event:${event.shareId}`, "cancelled");
    // no actor and no name: the host is gone, and so is who they were
    notify(
      guests.filter((g) => g.response !== "declined").map((g) => g.personId),
      { kind: "invite", text: `${event.title} was cancelled`, href: "/events" },
    );
    for (const g of guests) publish(`person:${g.personId}`, "events");
  }
  for (const { event, personIds } of gone.promoted) {
    logActivity({ who, action: "left", target: eventRef(event), outcome: "ok", detail: `${personIds.length} promoted from waitlist` });
    publish(`event:${event.shareId}`, "guests");
    notify(personIds, { kind: "promoted", text: `A spot opened up: you're going to ${event.title}`, href: `/e/${event.shareId}` });
  }

  cookies.delete("hp", { path: "/" });
  for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
    const name = pair.trim().split("=")[0];
    if (name?.startsWith("hg_")) cookies.delete(name, { path: "/" });
  }
  // no flash: "loggedOut" promises the link brings you back, and it won't
  return redirect("/welcome", 303);
};

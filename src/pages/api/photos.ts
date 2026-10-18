import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse, threadTarget } from "../../lib/activity";
import { publish } from "../../lib/live";
import { saveImage } from "../../lib/media";
import { addPhoto } from "../../lib/memories";
import { notify } from "../../lib/notify";
import { openThread } from "../../lib/talk";

/** Add photos to a plan's album, once its day has come: real images only
 *  (checked by their bytes), 5 MB each, up to 10 at a time. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const thread = openThread(String(form.get("kind") ?? ""), String(form.get("ref") ?? ""), cookies);
  if (!thread) return refuse(cookies, "added photos to", threadTarget(thread, form.get("kind")), "not found", 404, "No such plan");
  if (!thread.visible) return refuse(cookies, "added photos to", threadTarget(thread, ""), "not your plan", 403, "This plan isn't yours");
  if (!thread.person) return redirect(thread.page, 303);
  if (!thread.canTalk) return refuse(cookies, "added photos to", threadTarget(thread, ""), "read-only", 409, "This plan can be read, not added to");
  if (!thread.arrived) return refuse(cookies, "added photos to", threadTarget(thread, ""), "not the day yet", 409, "Photos open on the day");

  const files = form.getAll("photo").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
  let added = 0;
  for (const file of files) {
    const saved = await saveImage(file);
    if ("error" in saved) {
      return new Response(saved.error === "too-big" ? "Photos can be up to 5 MB" : "That isn't a JPEG, PNG or WebP image", {
        status: saved.error === "too-big" ? 413 : 415,
      });
    }
    addPhoto(thread.target, thread.person.id, saved.file, saved.mime);
    added++;
  }
  if (added > 0) {
    logActivity({ who: personLabel(thread.person), action: "added photos to", target: threadTarget(thread, ""), outcome: "ok", detail: `${added} photo${added === 1 ? "" : "s"}` });
    publish(`thread:${thread.kind}:${thread.ref}`, "photos");
    notify(thread.audience(), {
      kind: "photo",
      text: `${thread.person.name} added ${added === 1 ? "a photo" : `${added} photos`} to ${thread.title}`,
      href: thread.page,
      actorId: thread.person.id,
      groupId: thread.groupId,
    });
  }
  return redirect(thread.page, 303);
};

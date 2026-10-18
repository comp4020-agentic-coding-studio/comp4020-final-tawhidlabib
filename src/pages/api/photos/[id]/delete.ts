import type { APIRoute } from "astro";
import { logActivity, personLabel, refuse } from "../../../../lib/activity";
import { publish } from "../../../../lib/live";
import { deleteImage } from "../../../../lib/media";
import { deletePhoto, photoById, photoTarget } from "../../../../lib/memories";
import { threadFor } from "../../../../lib/talk";

/** Take a photo down: whoever added it can, and so can an event's host. */
export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  const photo = photoById(Number(params.id));
  if (!photo) return refuse(cookies, "deleted photo", `photo ${params.id}`, "not found", 404, "No such photo");
  const thread = threadFor(photoTarget(photo), cookies);
  const me = thread?.person;
  if (!thread || !me || (me.id !== photo.uploaderId && me.id !== thread.moderatorId)) {
    return refuse(cookies, "deleted photo", `photo ${photo.id}`, "not its uploader", 403, "Only whoever added a photo can take it down");
  }
  deletePhoto(photo.id);
  logActivity({ who: personLabel(me), action: "deleted photo", target: `photo ${photo.id} on ${thread.kind} ${thread.target.id}`, outcome: "ok" });
  await deleteImage(photo.file);
  publish(`thread:${thread.kind}:${thread.ref}`, "photos");
  return redirect(thread.page, 303);
};

import type { APIRoute } from "astro";
import { publish } from "../../../../lib/live";
import { deleteImage } from "../../../../lib/media";
import { deletePhoto, photoById, photoTarget } from "../../../../lib/memories";
import { threadFor } from "../../../../lib/talk";

/** Take a photo down: whoever added it can, and so can an event's host. */
export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  const photo = photoById(Number(params.id));
  if (!photo) return new Response("No such photo", { status: 404 });
  const thread = threadFor(photoTarget(photo), cookies);
  const me = thread?.person;
  if (!thread || !me || (me.id !== photo.uploaderId && me.id !== thread.moderatorId)) {
    return new Response("Only whoever added a photo can take it down", { status: 403 });
  }
  deletePhoto(photo.id);
  await deleteImage(photo.file);
  publish(`thread:${thread.kind}:${thread.ref}`, "photos");
  return redirect(thread.page, 303);
};

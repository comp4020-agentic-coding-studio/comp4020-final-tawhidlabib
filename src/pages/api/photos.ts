import type { APIRoute } from "astro";
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
  if (!thread) return new Response("No such plan", { status: 404 });
  if (!thread.visible) return new Response("This plan isn't yours", { status: 403 });
  if (!thread.person) return redirect(thread.page, 303);
  if (!thread.canTalk) return new Response("This plan can be read, not added to", { status: 409 });
  if (!thread.arrived) return new Response("Photos open on the day", { status: 409 });

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

import type { APIRoute } from "astro";
import { setAvatar } from "../../../lib/avatars";
import { flash } from "../../../lib/flash";
import { currentPerson } from "../../../lib/identity";
import { deleteImage, saveImage } from "../../../lib/media";

/** Upload a photo avatar (a real image, up to 5 MB), or remove it. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const me = currentPerson(cookies);
  if (!me) return redirect("/me", 303);
  const form = await request.formData();

  if (form.get("action") === "remove") {
    if (me.avatarPhoto) await deleteImage(me.avatarPhoto);
    setAvatar(me.id, { avatarPhoto: null });
    flash(cookies, "avatar");
    return redirect("/me", 303);
  }

  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return redirect("/me", 303);
  const saved = await saveImage(file);
  if ("error" in saved) {
    return new Response(saved.error === "too-big" ? "Photos can be up to 5 MB" : "That isn't a JPEG, PNG or WebP image", {
      status: saved.error === "too-big" ? 413 : 415,
    });
  }
  if (me.avatarPhoto) await deleteImage(me.avatarPhoto);
  setAvatar(me.id, { avatarPhoto: saved.file });
  flash(cookies, "avatar");
  return redirect("/me", 303);
};

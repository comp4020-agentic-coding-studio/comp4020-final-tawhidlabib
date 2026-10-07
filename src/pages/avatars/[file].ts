import type { APIRoute } from "astro";
import { isAvatarFile } from "../../lib/avatars";
import { mimeOf, readImage } from "../../lib/media";

/** Someone's avatar photo: public, like their name. Only files that really
 *  are an avatar --- album photos live in the same folder and stay behind
 *  /media's access check. */
export const GET: APIRoute = async ({ params }) => {
  const file = params.file ?? "";
  const bytes = isAvatarFile(file) ? await readImage(file) : undefined;
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, {
    headers: {
      "content-type": mimeOf(file),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
};

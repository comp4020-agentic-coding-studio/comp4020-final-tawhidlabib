import type { APIRoute } from "astro";
import { mimeOf, readImage } from "../../lib/media";
import { photoByFile, photoTarget } from "../../lib/memories";
import { threadFor } from "../../lib/talk";

/** An album photo, for the people its plan is for and nobody else. */
export const GET: APIRoute = async ({ params, cookies }) => {
  const file = params.file ?? "";
  const photo = photoByFile(file);
  if (!photo) return new Response("Not found", { status: 404 });
  if (!threadFor(photoTarget(photo), cookies)?.visible) return new Response("Not yours to see", { status: 403 });
  const bytes = await readImage(file);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, {
    headers: {
      "content-type": mimeOf(file),
      // private: it's behind an access check, so no shared cache may keep it
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
};

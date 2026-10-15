import { revalidateTag } from "next/cache";
import { errorResponse, requireUser } from "@/lib/firebase-admin";
import { CATEGORIES_TAG } from "@/lib/categories-server";

/** Called after an admin manager changes a price or photos, so the next page load serves the new ones */
export async function POST(req: Request) {
  try {
    await requireUser(req, ["admin"]);
    revalidateTag(CATEGORIES_TAG, { expire: 0 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

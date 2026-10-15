import { listBanks } from "@/lib/bachs";
import { connection } from "next/server";
import { errorResponse, requireUser } from "@/lib/firebase-admin";

/** Nigerian banks Bachs can pay out to, for the add-account form */
export async function GET(req: Request) {
  await connection(); // per-request: reads the caller's sign-in token
  try {
    await requireUser(req, ["admin"]);
    return Response.json({ banks: await listBanks() });
  } catch (err) {
    return errorResponse(err);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, errorResponse, HttpError, requireUser } from "@/lib/firebase-admin";

/** Admin managers add a staff member or another admin manager. */
export async function POST(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const { name, email, role, password } = (await req.json()) as { name?: string; email?: string; role?: string; password?: string };
    if (!name?.trim() || !email || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Enter a name and a valid work email.");
    if (role !== "staff" && role !== "admin") throw new HttpError(400, "Role must be staff or admin.");
    if (!password || password.length < 8) throw new HttpError(400, "The temporary password needs at least 8 characters.");

    let user;
    try {
      user = await adminAuth().createUser({ email, password, displayName: name });
    } catch (e) {
      const code = (e as { code?: string }).code;
      throw new HttpError(409, code === "auth/email-already-exists" ? "Someone already uses that email." : "Couldn't create that account.");
    }
    const now = FieldValue.serverTimestamp(); // Firebase's clock
    const db = adminDb();
    await db.collection("users").doc(user.uid).set({ name, email, role, createdAt: now });
    await db.collection("activity").add({
      type: "team_added",
      message: `${admin.name} added ${role === "admin" ? "admin manager" : "staff member"} ${name}`,
      actorId: admin.uid,
      actorName: admin.name,
      createdAt: now,
    });
    return Response.json({ uid: user.uid }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Admin managers remove a staff member or another admin manager (never themselves). */
export async function DELETE(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const uid = new URL(req.url).searchParams.get("uid");
    if (!uid) throw new HttpError(400, "Missing team member.");
    if (uid === admin.uid) throw new HttpError(400, "You can't remove your own account.");

    const db = adminDb();
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists || !["staff", "admin"].includes(snap.get("role"))) throw new HttpError(404, "That team member doesn't exist.");
    await adminAuth().deleteUser(uid).catch(() => undefined);
    await snap.ref.delete();
    await db.collection("activity").add({
      type: "team_removed",
      message: `${admin.name} removed ${snap.get("name")}`,
      actorId: admin.uid,
      actorName: admin.name,
      createdAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

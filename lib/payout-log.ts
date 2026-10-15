import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

/** Records bank-detail changes in the activity log (server only) */
export async function logPayoutChange(actor: { uid: string; name: string }, message: string) {
  await adminDb().collection("activity").add({ type: "payout_account", message, actorId: actor.uid, actorName: actor.name, createdAt: FieldValue.serverTimestamp() });
}

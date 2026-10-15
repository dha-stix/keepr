// Server only. Records a successful Bachs collection against its booking. Used by both ways a payment can
// reach Keepr: the Bachs webhook, and /api/bachs/confirm when the guest comes back from Bachs (in case the
// webhook is late or missing). Whichever arrives first marks the booking paid; the other finds it already paid.
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { PAID_STATUSES, type CollectionEvent } from "./bachs";
import { withIsoDates } from "./timestamps";
import type { Booking, Payment } from "./types";
import { priceBooking } from "./utils";

export type RecordResult = "paid" | "duplicate" | "no booking" | "already paid" | "underpaid";

export async function recordCollection(db: Firestore, bookingId: string, collection: CollectionEvent): Promise<RecordResult> {
  return db.runTransaction(async tx => {
    // At-least-once delivery: remember every event id we've handled
    const seenRef = db.collection("webhook_events").doc(collection.eventId);
    if ((await tx.get(seenRef)).exists) return "duplicate";
    const ref = db.collection("bookings").doc(bookingId);
    const snap = await tx.get(ref);
    if (!snap.exists) return "no booking";
    const booking = { ...withIsoDates(snap.data()), id: snap.id } as Booking;

    tx.set(seenRef, { type: "collection.succeeded", bookingId, receivedAt: FieldValue.serverTimestamp() });
    if (booking.status !== "pending_payment") return "already paid";

    const expected = priceBooking(booking).total;
    const now = FieldValue.serverTimestamp(); // Firebase's clock for every time written here
    const enough = PAID_STATUSES.includes(collection.status) && collection.currency === "NGN" && collection.amount >= expected;
    if (!enough) {
      // Money arrived but not the full amount (or in another currency): flag it for a manager instead of confirming the stay
      tx.set(db.collection("activity").doc(), {
        type: "payment_received",
        message: `Bachs reported ${collection.currency} ${collection.amount.toLocaleString("en-NG")} (${collection.status}) for ${booking.code}, but ₦${expected.toLocaleString("en-NG")} is due. Check it in the Bachs dashboard.`,
        actorId: "bachs",
        actorName: "Bachs",
        createdAt: now,
      });
      return "underpaid";
    }

    const reference = collection.chargeId ?? collection.eventId;
    tx.update(ref, { status: "paid", paymentRef: reference, paidAt: now, total: expected });
    tx.update(db.collection("holds").doc(booking.id), { status: "paid" });
    // paidAt is Firebase server time (read back as an ISO string)
    const payment: Omit<Payment, "id" | "paidAt"> & { paidAt: FieldValue } = {
      bookingId: booking.id,
      bookingCode: booking.code,
      userId: booking.userId,
      guestName: booking.guestName,
      category: booking.category,
      amount: collection.amount,
      currency: "NGN",
      reference,
      provider: "bachs",
      status: "succeeded",
      paidAt: now,
      ...(collection.method ? { method: collection.method } : {}),
      ...(collection.checkoutId ? { checkoutId: collection.checkoutId } : {}),
      ...(collection.settlementAmount != null ? { settlementAmount: collection.settlementAmount } : {}),
      ...(collection.processingFee != null ? { processingFee: collection.processingFee } : {}),
    };
    tx.set(db.collection("payments").doc(reference), payment);
    tx.set(db.collection("activity").doc(), {
      type: "payment_received",
      message: `Bachs payment of ₦${collection.amount.toLocaleString("en-NG")} received for ${booking.code}`,
      actorId: "bachs",
      actorName: "Bachs",
      createdAt: now,
    });
    return "paid";
  });
}

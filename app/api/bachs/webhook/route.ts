import { PAID_STATUSES, parseCollectionEvent, parseRefundEvent, verifyWebhook, type RefundEvent } from "@/lib/bachs";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { applyRefund } from "@/lib/refunds";
import { withIsoDates } from "@/lib/timestamps";
import type { Booking, Payment } from "@/lib/types";
import { priceBooking } from "@/lib/utils";

/**
 * Bachs webhook. Subscribe your endpoint to `collection.succeeded`, `refund.created`, `refund.paid` and
 * `refund.failed`, and point it at https://<your-domain>/api/bachs/webhook.
 * This is the only place a booking becomes "paid", and where refunds are confirmed.
 *
 * Responses follow Bachs' retry rules: 400 for a delivery we reject (bad signature, unreadable body),
 * 5xx when our own processing fails so Bachs retries, and 200 for everything else, including events we ignore.
 */
export async function POST(req: Request) {
  const raw = await req.text(); // raw body: parsing first would break the signature
  if (!verifyWebhook(raw, req.headers)) return Response.json({ error: "Invalid signature" }, { status: 400 });

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const refund = parseRefundEvent(event);
  if (refund) return handleRefund(refund);
  const collection = parseCollectionEvent(event);
  if (!collection) return Response.json({ received: true, ignored: event.type });

  try {
    const db = adminDb();

    // Find the booking: metadata first, then the checkout session we stored on it
    let bookingId = collection.bookingId;
    if (!bookingId && collection.checkoutId) {
      const found = await db.collection("bookings").where("checkoutId", "==", collection.checkoutId).limit(1).get();
      bookingId = found.docs[0]?.id;
    }
    if (!bookingId) {
      console.warn("Bachs payment with no matching booking", collection);
      return Response.json({ received: true, ignored: "no booking" });
    }

    const result = await db.runTransaction(async tx => {
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
    return Response.json({ received: true, result });
  } catch (err) {
    console.error("Bachs webhook processing failed", err);
    return Response.json({ error: "Processing failed" }, { status: 500 }); // Bachs retries 5xx
  }
}

/**
 * refund.created / refund.paid / refund.failed: updates the payment (doc id = charge id) and its booking.
 * Also covers refunds issued by hand in the Bachs dashboard.
 */
async function handleRefund({ eventId, type, refund }: RefundEvent) {
  try {
    const db = adminDb();
    const result = await db.runTransaction(async tx => {
      const seenRef = db.collection("webhook_events").doc(eventId);
      if ((await tx.get(seenRef)).exists) return "duplicate";
      const paymentSnap = refund.chargeId ? await tx.get(db.collection("payments").doc(refund.chargeId)) : null;
      if (!paymentSnap?.exists) return "no payment";
      const payment = { ...withIsoDates(paymentSnap.data()), id: paymentSnap.id } as Payment;
      const bookingSnap = await tx.get(db.collection("bookings").doc(payment.bookingId));
      if (!bookingSnap.exists) return "no booking";
      const booking = { ...withIsoDates(bookingSnap.data()), id: bookingSnap.id } as Booking;

      tx.set(seenRef, { type, bookingId: booking.id, refundId: refund.refundId, receivedAt: FieldValue.serverTimestamp() });
      if (!applyRefund(tx, db, booking, payment, refund)) return "stale";
      if (type !== "refund.created") {
        const amount = `₦${(refund.refundedAmount || refund.requestedAmount || payment.amount).toLocaleString("en-NG")}`;
        tx.set(db.collection("activity").doc(), {
          type: "payment_refunded",
          message:
            type === "refund.paid"
              ? `Bachs paid out the ${amount} refund for ${booking.code} (${booking.guestName}). It can take 1 to 7 working days to reach the guest.`
              : `Bachs couldn't complete the ${amount} refund for ${booking.code}. Nothing moved; try the refund again.`,
          actorId: "bachs",
          actorName: "Bachs",
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return refund.status;
    });
    return Response.json({ received: true, result });
  } catch (err) {
    console.error("Bachs refund webhook processing failed", err);
    return Response.json({ error: "Processing failed" }, { status: 500 }); // Bachs retries 5xx
  }
}

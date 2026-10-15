// Server only: writes a Bachs refund's state onto the booking and payment (refund route and webhook).
import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { BachsRefund } from "./bachs";
import { withIsoDates } from "./timestamps";
import type { Booking, Payment } from "./types";

/** Reads the cancelled booking and its payment (doc id = Bachs charge id) inside a transaction */
export async function readRefundable(tx: Transaction, db: Firestore, bookingId: string) {
  const bookingSnap = await tx.get(db.collection("bookings").doc(bookingId));
  if (!bookingSnap.exists) return null;
  const booking = { ...withIsoDates(bookingSnap.data()), id: bookingSnap.id } as Booking;
  if (!booking.paymentRef) return { booking, payment: null };
  const paymentSnap = await tx.get(db.collection("payments").doc(booking.paymentRef));
  return { booking, payment: paymentSnap.exists ? ({ ...withIsoDates(paymentSnap.data()), id: paymentSnap.id } as Payment) : null };
}

/**
 * Applies a refund's state. The payment counts as "refunded" from the moment Bachs accepts the refund
 * (the balance is reserved then), and goes back to "succeeded" if the refund fails, since nothing moved.
 * Returns false when the update would be stale: a finished refund is never reopened, and events about
 * an older, superseded refund attempt are ignored.
 */
export function applyRefund(tx: Transaction, db: Firestore, booking: Booking, payment: Payment, refund: BachsRefund, reference?: string): boolean {
  if (booking.refundStatus === "refunded") return false;
  if (booking.refundId && refund.refundId && booking.refundId !== refund.refundId && refund.status !== "refunded") return false;
  if (booking.refundStatus === "failed" && booking.refundId === refund.refundId && refund.status === "processing") return false;

  const now = FieldValue.serverTimestamp(); // Firebase's clock (Bachs's own time stays in the Bachs dashboard)
  const bookingRef = db.collection("bookings").doc(booking.id);
  const paymentRef = db.collection("payments").doc(payment.id);
  const refundReference = reference ?? (refund.reference || booking.refundReference);

  if (refund.status === "failed") {
    tx.update(bookingRef, { refundStatus: "failed", refundId: refund.refundId, refundError: "Bachs couldn't complete the refund. Nothing was taken from the balance; you can try again." });
    tx.update(paymentRef, { status: "succeeded", refundId: FieldValue.delete(), refundedAmount: FieldValue.delete(), refundedAt: FieldValue.delete() });
    return true;
  }
  const done = refund.status === "refunded";
  tx.update(bookingRef, {
    refundStatus: refund.status,
    refundId: refund.refundId,
    ...(refundReference ? { refundReference } : {}),
    ...(done ? { refundedAt: now } : {}),
    refundError: FieldValue.delete(),
  });
  tx.update(paymentRef, {
    status: "refunded",
    refundId: refund.refundId,
    refundedAmount: refund.refundedAmount ?? refund.requestedAmount ?? payment.amount,
    ...(done ? { refundedAt: now } : {}),
  });
  return true;
}

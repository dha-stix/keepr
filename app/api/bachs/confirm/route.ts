import { getCheckoutPayment } from "@/lib/bachs";
import { adminDb, errorResponse, HttpError, requireUser } from "@/lib/firebase-admin";
import { recordCollection } from "@/lib/payments";
import type { Booking } from "@/lib/types";

/**
 * Called by the checkout page when the guest comes back from Bachs. Asks Bachs directly whether the booking's
 * checkout was paid and, if so, records it exactly like the webhook would. This way a late or missing webhook
 * never leaves a paid guest waiting. Only the checkout session stored on the booking is checked, so the browser
 * can't point it at someone else's payment.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { bookingId } = (await req.json().catch(() => ({}))) as { bookingId?: string };
    if (!bookingId) throw new HttpError(400, "Missing booking.");

    const db = adminDb();
    const snap = await db.collection("bookings").doc(bookingId).get();
    if (!snap.exists) throw new HttpError(404, "We couldn't find that booking.");
    const booking = snap.data() as Booking;
    if (booking.userId !== user.uid) throw new HttpError(403, "This booking belongs to another account.");
    if (booking.status !== "pending_payment") return Response.json({ status: booking.status });
    if (!booking.checkoutId) throw new HttpError(409, "This booking hasn't started a payment yet.");

    const payment = await getCheckoutPayment(booking.checkoutId);
    if (!payment) return Response.json({ status: "pending_payment" });
    if (payment.bookingId && payment.bookingId !== bookingId) throw new HttpError(409, "That payment belongs to another booking.");

    const result = await recordCollection(db, bookingId, payment);
    return Response.json({ status: result === "paid" || result === "already paid" || result === "duplicate" ? "paid" : "pending_payment", result });
  } catch (err) {
    return errorResponse(err);
  }
}

import { FieldValue } from "firebase-admin/firestore";
import { createRefund, type BachsRefund } from "@/lib/bachs";
import { adminDb, errorResponse, HttpError, requireRecentSignIn, requireUser } from "@/lib/firebase-admin";
import { applyRefund, readRefundable } from "@/lib/refunds";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/**
 * Admin managers refund a cancelled, paid booking in full through Bachs. Requires a password check in the last 10 minutes.
 * The refund finishes asynchronously: the Bachs webhook (refund.paid / refund.failed) records the outcome.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    await requireRecentSignIn(admin, "send a refund");
    const { bookingId } = (await req.json().catch(() => ({}))) as { bookingId?: string };
    if (!bookingId) throw new HttpError(400, "Missing booking.");
    const db = adminDb();

    // Claim the booking first so two managers (or a double click) can't send two refunds
    const { booking, payment, reference } = await db.runTransaction(async tx => {
      const found = await readRefundable(tx, db, bookingId);
      if (!found) throw new HttpError(404, "We couldn't find that booking.");
      const { booking, payment } = found;
      if (booking.status !== "cancelled") throw new HttpError(409, "Only cancelled bookings can be refunded.");
      if (!booking.paidAt || !payment) throw new HttpError(409, "There's no Bachs payment on this booking to refund.");
      if (booking.refundStatus === "refunded") throw new HttpError(409, "This booking has already been refunded.");
      if (booking.refundStatus === "processing" && booking.refundId) throw new HttpError(409, "A refund for this booking is already on its way.");
      // Outcome of an earlier attempt unknown (Bachs didn't answer): reuse its reference, which is also the idempotency key
      const reference = booking.refundStatus === "processing" && booking.refundReference ? booking.refundReference : `${booking.code}-refund-${Date.now().toString(36)}`;
      tx.update(db.collection("bookings").doc(booking.id), { refundStatus: "processing", refundReference: reference, refundError: FieldValue.delete() });
      return { booking, payment, reference };
    });

    let refund: BachsRefund | null;
    try {
      refund = await createRefund({ chargeId: payment.reference, reference, reason: `Booking ${booking.code} cancelled` });
    } catch (err) {
      // Refused: nothing moved, so the refund can be tried again
      const message = err instanceof HttpError ? err.message : "Bachs refused the refund.";
      await db.collection("bookings").doc(booking.id).update({ refundStatus: "failed", refundError: message });
      throw err;
    }

    const amount = naira(payment.amount);
    const log = (message: string) => db.collection("activity").add({ type: "payment_refunded", message, actorId: admin.uid, actorName: admin.name, createdAt: FieldValue.serverTimestamp() });
    if (!refund) {
      await log(`${admin.name} sent a ${amount} refund for ${booking.code} to Bachs; waiting for Bachs to confirm it`);
      return Response.json({ status: "processing" }, { status: 202 });
    }

    const status = await db.runTransaction(async tx => {
      const found = await readRefundable(tx, db, booking.id);
      if (!found?.payment) return refund.status;
      applyRefund(tx, db, found.booking, found.payment, refund, reference);
      return refund.status;
    });
    await log(
      status === "failed"
        ? `${admin.name} tried to refund ${amount} for ${booking.code}, but Bachs couldn't complete it`
        : `${admin.name} refunded ${amount} for ${booking.code} (${booking.guestName}) through Bachs${status === "refunded" ? "" : "; Bachs is processing it"}`,
    );
    return Response.json({ status, refundId: refund.refundId }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

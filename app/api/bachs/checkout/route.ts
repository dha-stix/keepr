import { holdExpiryMs, roomIsFree, type Hold } from "@/lib/booking-rules";
import { createCheckoutSession } from "@/lib/bachs";
import { adminDb, errorResponse, HttpError, requireUser } from "@/lib/firebase-admin";
import { withIsoDates } from "@/lib/timestamps";
import type { Booking } from "@/lib/types";
import { SITE_URL } from "@/lib/site";
import { priceBooking } from "@/lib/utils";

/** Creates a Bachs checkout session for one of the caller's unpaid bookings and returns the hosted checkout URL. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { bookingId } = (await req.json()) as { bookingId?: string };
    if (!bookingId) throw new HttpError(400, "Missing booking.");

    const db = adminDb();
    const ref = db.collection("bookings").doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "We couldn't find that booking.");
    const booking = { ...withIsoDates(snap.data()), id: snap.id } as Booking;
    if (booking.userId !== user.uid) throw new HttpError(403, "This booking belongs to another account.");
    if (booking.status !== "pending_payment") throw new HttpError(409, "This booking is already paid.");
    const now = snap.readTime.toMillis(); // Firebase's time when the booking was read, not the server's clock
    const holdLeftMs = Math.min(holdExpiryMs(booking) - now, 16 * 60_000);
    if (holdLeftMs < 60_000) throw new HttpError(410, "Your 15-minute hold has run out. Please pick the room again.");

    // The booking's room type must be the room's real type (the price depends on it)
    const room = await db.collection("rooms").doc(booking.roomId).get();
    if (!room.exists || room.get("category") !== booking.category || room.get("number") !== booking.roomNumber)
      throw new HttpError(400, "This booking doesn't match its room. Please book again.");

    // Re-check availability on the server so two guests can't pay for the same nights
    const holds = await db.collection("holds").where("checkOut", ">", booking.checkIn).get();
    const others = holds.docs.filter(d => d.id !== booking.id).map(d => withIsoDates<Hold>(d.data()));
    if (!roomIsFree(booking.roomId, booking.checkIn, booking.checkOut, others, now))
      throw new HttpError(409, `Room ${booking.roomNumber} was just booked for those dates. Please pick another room.`);

    // Never trust the total the browser wrote: price the stay again from the locked nightly rate
    // (firestore.rules only accept a booking whose nightlyRate matches the room type's price)
    const price = priceBooking(booking);

    // Bachs refuses localhost return URLs, so use the public site address (APP_URL) when set
    const base = process.env.APP_URL || process.env.VERCEL_URL ? SITE_URL : new URL(req.url).origin;
    const session = await createCheckoutSession({
      bookingId: booking.id,
      bookingCode: booking.code,
      amount: price.total,
      customer: { name: booking.guestName, email: booking.guestEmail, phone: booking.phone },
      successUrl: `${base}/checkout/${booking.id}`, // Bachs appends ?checkout_id=
      cancelUrl: `${base}/checkout/${booking.id}?status=cancelled`,
      expiresInMinutes: holdLeftMs / 60_000,
    });

    await ref.update({ ...price, checkoutId: session.checkoutId });
    return Response.json({ checkoutUrl: session.checkoutUrl });
  } catch (err) {
    return errorResponse(err);
  }
}

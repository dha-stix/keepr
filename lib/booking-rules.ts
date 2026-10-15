// Business rules shared by the Firestore actions and the server routes,
// so a booking moves through its life the same way everywhere.
import { ACTIVE_BOOKING, CATEGORIES, HOLD_MINUTES } from "./constants";
import type { ActivityType, Actor, AppUser, Booking, BookingStatus, NewBookingInput, Room, RoomStatus } from "./types";
import { makeBookingCode, nightsBetween, priceStay, rangesOverlap, todayISO } from "./utils";

export type DeskAction = "confirmPayment" | "checkIn" | "checkOut" | "cancel";

interface Transition {
  from: BookingStatus[];
  to: BookingStatus;
  room: RoomStatus | null;
  activity: ActivityType;
  message: (b: Booking, actor: Actor) => string;
  stamp?: keyof Booking;
}

export const TRANSITIONS: Record<DeskAction, Transition> = {
  confirmPayment: {
    from: ["paid"],
    to: "confirmed",
    room: null,
    activity: "payment_confirmed",
    message: (b, a) => `${a.name} confirmed payment for ${b.code} (${b.guestName})`,
  },
  checkIn: {
    from: ["confirmed"],
    to: "checked_in",
    room: "occupied",
    activity: "checked_in",
    message: (b, a) => `${a.name} checked in ${b.guestName} to room ${b.roomNumber}`,
    stamp: "checkedInAt",
  },
  checkOut: {
    from: ["checked_in"],
    to: "checked_out",
    room: "cleaning",
    activity: "checked_out",
    message: (b, a) => `${a.name} checked out ${b.guestName}; room ${b.roomNumber} set to cleaning`,
    stamp: "checkedOutAt",
  },
  cancel: {
    from: ["pending_payment", "paid", "confirmed"],
    to: "cancelled",
    room: null,
    activity: "booking_cancelled",
    // A paid booking that's cancelled needs refunding (admin managers do it from the bookings table); say so in the activity log
    message: (b, a) => `${a.name} cancelled ${b.code}${b.status === "pending_payment" ? "" : ` (paid ₦${b.total.toLocaleString("en-NG")}: refund due)`}`,
  },
};

/** Validates a desk action and returns the patch to apply, or throws a readable error */
export function planTransition(booking: Booking, action: DeskAction, actor: Actor) {
  const t = TRANSITIONS[action];
  if (!t.from.includes(booking.status)) {
    const needs: Record<DeskAction, string> = {
      confirmPayment: "Only paid bookings can be confirmed.",
      checkIn: "Confirm the payment before checking the guest in.",
      checkOut: "Only guests who are checked in can be checked out.",
      cancel: "This booking can no longer be cancelled.",
    };
    throw new Error(needs[action]);
  }
  const patch: Partial<Booking> = { status: t.to };
  // Marks which time field to set; the caller saves Firebase's server timestamp there (see runDeskAction)
  if (t.stamp) (patch as Record<string, string>)[t.stamp] = SERVER_TIME;
  if (action === "confirmPayment") patch.confirmedBy = actor.name;
  return { patch, roomStatus: t.room, activity: { type: t.activity, message: t.message(booking, actor) } };
}

/** `nightlyRate` is the room type's current price; it is locked into the booking. `nowMs` is Firebase's time. */
export function buildBooking(input: NewBookingInput, room: Room, user: AppUser, nightlyRate: number, nowMs: number): Omit<Booking, "id"> {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (input.checkIn < todayISO(nowMs)) throw new Error("Check-in can't be in the past. Pick today or a later date.");
  if (nights < 1) throw new Error("Check-out must be at least one night after check-in.");
  if (input.guests > CATEGORIES[room.category].maxGuests)
    throw new Error(`${CATEGORIES[room.category].name} rooms sleep up to ${CATEGORIES[room.category].maxGuests} guests.`);
  const price = priceStay(nightlyRate, nights, room.category);
  return {
    code: makeBookingCode(),
    userId: user.uid,
    guestName: user.name,
    guestEmail: user.email,
    phone: user.phone ?? "",
    roomId: room.id,
    roomNumber: room.number,
    category: room.category,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    guests: input.guests,
    nightlyRate,
    ...price,
    status: "pending_payment",
    // Firebase replaces this with its server time when the booking is saved (see createBooking)
    createdAt: new Date(nowMs).toISOString(),
  };
}

/**
 * What the room board shows. Stored room status only tracks the physical room (available, occupied, cleaning);
 * "reserved" is derived: a free room with a live booking arriving today.
 */
export function displayRoomStatus(room: Room, bookings: Pick<Booking, "roomId" | "checkIn" | "status">[], today: string): RoomStatus {
  if (room.status === "occupied" || room.status === "cleaning") return room.status;
  const arriving = bookings.some(b => b.roomId === room.id && b.checkIn === today && (b.status === "paid" || b.status === "confirmed"));
  return arriving ? "reserved" : "available";
}

export interface Hold {
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  /** Firebase server time the booking was made */
  createdAt?: string;
}

/** When an unpaid hold runs out: HOLD_MINUTES after Firebase recorded the booking (so the browser can't extend it) */
export const holdExpiryMs = (h: Pick<Hold, "createdAt">) => (h.createdAt ? new Date(h.createdAt).getTime() + HOLD_MINUTES * 60_000 : 0);

/** Placeholder for a time Firebase fills in with its server timestamp when the document is saved */
export const SERVER_TIME = "server-time";

/** Does this hold still block its room at `nowMs` (Firebase's time)? Unpaid holds lapse after HOLD_MINUTES. */
export function holdIsLive(h: Hold, nowMs: number) {
  if (!ACTIVE_BOOKING.includes(h.status)) return false;
  if (h.status === "pending_payment" && holdExpiryMs(h) < nowMs) return false;
  return true;
}

export function roomIsFree(roomId: string, checkIn: string, checkOut: string, holds: Hold[], nowMs: number) {
  return !holds.some(h => h.roomId === roomId && holdIsLive(h, nowMs) && rangesOverlap(checkIn, checkOut, h.checkIn, h.checkOut));
}

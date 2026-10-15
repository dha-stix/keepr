import type { StaticImageData } from "next/image";

export type Role = "customer" | "staff" | "admin";

/** A built-in photo from /images, or one a manager uploaded (Firebase Storage URL) */
export type Photo = StaticImageData | string;

/** Manager-editable settings for a room type, stored in categories/{key} */
export interface CategorySettings {
  price: number; // naira per night
  /** 1–10 photos in order, cover first: uploaded photo URLs and/or "builtin:N" tokens for the built-in photos (see lib/categories.ts) */
  photos: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export type CategoryKey = "standard" | "exclusive" | "presidential";

export type RoomStatus = "available" | "reserved" | "occupied" | "cleaning";

export type BookingStatus =
  | "pending_payment" // created, room held while the guest pays
  | "paid" // Bachs confirmed the money arrived
  | "confirmed" // front desk confirmed the payment
  | "checked_in"
  | "checked_out"
  | "cancelled";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: Role;
  photoURL?: string | null;
  phone?: string;
  createdAt: string;
  lastActive?: string;
}

export interface Room {
  id: string; // "room-164"
  number: number;
  category: CategoryKey;
  status: RoomStatus;
  wing: string;
  note?: string;
}

export interface Booking {
  id: string;
  code: string; // KPR-7Q4M, shown at the front desk
  userId: string;
  guestName: string;
  guestEmail: string;
  phone?: string;
  arrivalWindow?: string;
  airportPickup?: boolean;
  roomId: string;
  roomNumber: number;
  category: CategoryKey;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  guests: number;
  /** Price per night when the booking was made. Later price changes don't affect it. */
  nightlyRate: number;
  subtotal: number;
  extras: number;
  vat: number;
  total: number;
  status: BookingStatus;
  paymentRef?: string;
  checkoutId?: string; // Bachs checkout session (chk_...)
  paidAt?: string;
  /** Refund of a cancelled paid booking, written by the server (refund route and Bachs webhook) */
  refundStatus?: RefundStatus;
  refundId?: string; // Bachs refund (rfnd_...)
  refundReference?: string; // our unique reference for that refund
  refundedAt?: string;
  refundError?: string;
  confirmedBy?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  createdAt: string;
}

/** processing: sent to Bachs; refunded: Bachs paid it out (refund.paid); failed: nothing moved, can retry */
export type RefundStatus = "processing" | "refunded" | "failed";

export interface Payment {
  id: string;
  bookingId: string;
  bookingCode: string;
  userId: string;
  guestName: string;
  category?: CategoryKey;
  amount: number; // naira
  currency?: "NGN";
  reference: string; // Bachs charge id (ch_...)
  provider: "bachs";
  status: "succeeded" | "refunded";
  paidAt: string;
  method?: string; // card, bank_transfer, mobile_money, crypto
  checkoutId?: string;
  settlementAmount?: number; // what lands in the Bachs balance after fees
  processingFee?: number;
  confirmedBy?: string;
  refundId?: string;
  refundedAmount?: number;
  refundedAt?: string;
}

export type ActivityType =
  | "booking_created"
  | "payment_received"
  | "payment_confirmed"
  | "checked_in"
  | "checked_out"
  | "booking_cancelled"
  | "room_status"
  | "team_added"
  | "team_removed"
  | "room_type_updated"
  | "payout_account"
  | "payment_refunded";

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  message: string;
  actorId: string;
  actorName: string;
  createdAt: string;
}

export interface Actor {
  uid: string;
  name: string;
}

export interface NewBookingInput {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

export interface AvailabilityQuery {
  checkIn?: string;
  checkOut?: string;
  category?: CategoryKey | "all";
}

export type Unsubscribe = () => void;

/** A Nigerian bank from Bachs' bank list */
export interface Bank {
  code: string;
  name: string;
}

/**
 * A bank account the hotel's Bachs balance pays out to (a Bachs "payout destination").
 * Account numbers never leave the server unmasked.
 */
export interface BankDestination {
  id: string; // pd_...
  name: string;
  currency: string;
  bankName: string;
  bankCode: string;
  accountName: string;
  accountLast4: string;
  status: "pending_review" | "approved" | "rejected";
  statusReason?: string | null;
  isUsable: boolean;
  isDefault: boolean;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface BachsBalance {
  currency: string;
  available: number;
  pending: number;
}

export interface ResolvedAccount {
  resolved: boolean;
  accountName?: string;
  message?: string | null;
}

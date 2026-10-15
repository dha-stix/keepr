import type { StaticImageData } from "next/image";
import { images, type ImageKey } from "@/images";
import type { BookingStatus, CategoryKey, Role, RoomStatus } from "./types";

export const HOTEL = {
  name: "Keepr",
  address: "12 Admiralty Way, Lekki Phase 1, Lagos",
  phone: "+234 800 000 0000",
  checkInTime: "12:00",
  checkOutTime: "11:00",
  currency: "NGN",
  /** "Today" for bookings, the front desk and reports is the hotel's calendar day, whatever the visitor's time zone */
  timeZone: "Africa/Lagos",
};

export const VAT_RATE = 0.075;
export const HOLD_MINUTES = 15;
export const AIRPORT_PICKUP_FEE = 25000;
/** How far back staff can see payments. Admin managers see all time. firestore.rules allows one extra day for clock differences. */
export const STAFF_PAYMENT_DAYS = 8;

export interface Category {
  key: CategoryKey;
  name: string;
  /** Even room numbers only, inclusive */
  range: [number, number];
  price: number;
  size: string;
  bed: string;
  /** Most guests per room. Standard and Exclusive: 2, Presidential: 4 (also enforced in firestore.rules) */
  maxGuests: number;
  blurb: string;
  amenities: string[];
  /** Default price and the built-in photos; managers change both (see CategorySettings) */
  photos: StaticImageData[];
  /** Which files in /images the built-in photos are, in the same order */
  photoKeys: ImageKey[];
}

const builtIn = (...keys: ImageKey[]) => ({ photoKeys: keys, photos: keys.map(k => images[k]) });

/**
 * The three room types. `price` and `photos` are defaults: managers change them in Admin → Rooms
 * (stored in Firestore categories/{key}). If you change a default price here, change it in firestore.rules too.
 */
export const CATEGORIES: Record<CategoryKey, Category> = {
  standard: {
    key: "standard",
    name: "Standard",
    range: [100, 148],
    price: 45000,
    size: "24 m²",
    bed: "Queen bed",
    maxGuests: 2,
    blurb: "Queen bed, work desk and a rain shower. Right for one or two nights in town.",
    amenities: ["Queen bed, 24 m²", "Rain shower", "Work desk", "Smart TV", "Fibre Wi-Fi", "Daily housekeeping"],
    ...builtIn("standard1", "standard2", "standard3"),
  },
  exclusive: {
    key: "exclusive",
    name: "Exclusive",
    range: [150, 198],
    price: 95000,
    size: "40 m²",
    bed: "King bed",
    maxGuests: 2,
    blurb: "King bed, lounge seating, lagoon views, breakfast for two and executive lounge access.",
    amenities: ["King bed, 40 m²", "Lagoon or city view", "Breakfast for two", "Executive lounge access", "Nespresso machine", "Smart TV with streaming"],
    ...builtIn("exclusive1", "exclusive3", "exclusive2"),
  },
  presidential: {
    key: "presidential",
    name: "Presidential",
    range: [200, 230],
    price: 250000,
    size: "120 m²",
    bed: "2 bedrooms",
    maxGuests: 4,
    blurb: "Two-bedroom suite with living and dining rooms, a private terrace and a butler on call.",
    amenities: ["Two bedrooms, 120 m²", "Living and dining room", "Private terrace", "Butler on call", "Free airport pickup", "Late checkout until 14:00"],
    ...builtIn("presidential1", "presidential2", "presidential3"),
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export const roomCountFor = (c: Pick<Category, "range">) => (c.range[1] - c.range[0]) / 2 + 1;
export const TOTAL_ROOMS = CATEGORY_LIST.reduce((n, c) => n + roomCountFor(c), 0);

export const ROOM_STATUS: Record<RoomStatus, { label: string; pill: string; color: string }> = {
  available: { label: "Available", pill: "pill-ok", color: "var(--color-ok)" },
  reserved: { label: "Reserved", pill: "pill-info", color: "var(--color-info)" },
  occupied: { label: "Occupied", pill: "pill-bad", color: "var(--color-bad)" },
  cleaning: { label: "Cleaning", pill: "pill-warn", color: "var(--color-warn)" },
};

export const BOOKING_STATUS: Record<BookingStatus, { label: string; pill: string }> = {
  pending_payment: { label: "Awaiting payment", pill: "pill-mute" },
  paid: { label: "Paid · awaiting desk", pill: "pill-info" },
  confirmed: { label: "Confirmed", pill: "pill-ok" },
  checked_in: { label: "Checked in", pill: "pill-bad" },
  checked_out: { label: "Completed", pill: "pill-ok" },
  cancelled: { label: "Cancelled", pill: "pill-mute" },
};

/** Booking statuses that keep a room off the market for their dates */
export const ACTIVE_BOOKING: BookingStatus[] = ["pending_payment", "paid", "confirmed", "checked_in"];

/** The guest-facing journey, in order */
export const STAY_STEPS: { status: BookingStatus; label: string }[] = [
  { status: "pending_payment", label: "Booked" },
  { status: "paid", label: "Paid" },
  { status: "confirmed", label: "Desk confirms" },
  { status: "checked_in", label: "Checked in" },
  { status: "checked_out", label: "Checked out" },
];

/** Where each role lands after signing in, and where it signs in */
export const ROLE_HOME: Record<Role, string> = {
  customer: "/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
};
export const ROLE_LOGIN: Record<Role, string> = {
  customer: "/auth/login",
  staff: "/staff/login",
  admin: "/admin/login",
};

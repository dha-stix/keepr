import { AIRPORT_PICKUP_FEE, CATEGORIES, HOTEL, VAT_RATE } from "./constants";
import type { Booking, CategoryKey, Room } from "./types";

/** Only same-site paths are allowed as a post-sign-in destination ("//evil.com" and "/\\evil.com" are other sites) */
export const safeNext = (next: string | null | undefined, fallback: string) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

export const nairaShort = (n: number) =>
  n >= 1e6 ? `₦${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}m` : n >= 1e3 ? `₦${(n / 1e3).toFixed(1).replace(/\.0$/, "")}k` : naira(n);

/** YYYY-MM-DD in local time */
export const toISODate = (d: Date) => {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

const hotelDay = new Intl.DateTimeFormat("en-CA", { timeZone: HOTEL.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/** The hotel's calendar day (YYYY-MM-DD, Lagos time) at a moment in ms */
export const hotelDate = (ms: number) => hotelDay.format(ms);

/**
 * Today at the hotel. Pass Firebase's time, never the device's: firebaseNow() in the browser (lib/firebase-clock.ts),
 * firebaseServerNow() on the server (lib/firebase-admin.ts).
 */
export const todayISO = (nowMs: number) => hotelDate(nowMs);

export const nightsBetween = (checkIn: string, checkOut: string) =>
  Math.max(0, Math.round((new Date(checkOut + "T00:00:00").getTime() - new Date(checkIn + "T00:00:00").getTime()) / 864e5));

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-GB", opts);

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const stayRange = (checkIn: string, checkOut: string) =>
  `${formatDate(checkIn, { day: "2-digit" })}–${formatDate(checkOut, { day: "2-digit", month: "short", year: "numeric" })}`;

/** Two date ranges overlap if one starts before the other ends (check-out day is free) */
export const rangesOverlap = (aIn: string, aOut: string, bIn: string, bOut: string) => aIn < bOut && bIn < aOut;

/** Prices a stay at a nightly rate. Presidential suites include the airport pickup. */
export function priceStay(nightlyRate: number, nights: number, category: CategoryKey, airportPickup = false) {
  const subtotal = nightlyRate * nights;
  const extras = airportPickup && category !== "presidential" ? AIRPORT_PICKUP_FEE : 0;
  const vat = Math.round((subtotal + extras) * VAT_RATE);
  return { subtotal, extras, vat, total: subtotal + extras + vat };
}

/** The rate a booking was made at (older bookings without one fall back to subtotal / nights, then the default price) */
export const rateOf = (b: Pick<Booking, "nightlyRate" | "subtotal" | "nights" | "category">) =>
  b.nightlyRate || (b.nights ? Math.round(b.subtotal / b.nights) : CATEGORIES[b.category].price);

/** Re-prices an existing booking from its locked rate. The server uses this so the browser can't change what's charged. */
export const priceBooking = (b: Pick<Booking, "nightlyRate" | "subtotal" | "nights" | "category" | "checkIn" | "checkOut" | "airportPickup">) =>
  priceStay(rateOf(b), nightsBetween(b.checkIn, b.checkOut), b.category, b.airportPickup);

export function categoryForNumber(n: number): CategoryKey {
  if (n >= CATEGORIES.presidential.range[0]) return "presidential";
  if (n >= CATEGORIES.exclusive.range[0]) return "exclusive";
  return "standard";
}

function wingFor(n: number, category: CategoryKey) {
  if (category === "standard") return n <= 124 ? "Garden wing · queen bed" : "Quiet wing · queen bed";
  if (category === "exclusive") return n <= 174 ? "East wing · lagoon view" : "East wing · city view";
  return n <= 214 ? "Top floor · two bedrooms" : "Top floor · private terrace";
}

/** The full inventory: even numbers 100–230 */
export function buildInventory(): Room[] {
  const rooms: Room[] = [];
  for (let n = 100; n <= 230; n += 2) {
    const category = categoryForNumber(n);
    rooms.push({ id: `room-${n}`, number: n, category, status: "available", wing: wingFor(n, category) });
  }
  return rooms;
}

/** A room's photos from its room type's photo set, rotated so neighbouring rooms don't all lead with the same picture */
export function roomPhotos<T>(room: Pick<Room, "number">, photos: T[]): T[] {
  if (!photos.length) return photos;
  const shift = (room.number / 2) % photos.length;
  return [...photos.slice(shift), ...photos.slice(0, shift)];
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const makeBookingCode = () =>
  "KPR-" + Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

export const makeId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join("");

export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

const hotelHour = new Intl.DateTimeFormat("en-GB", { timeZone: HOTEL.timeZone, hour: "numeric", hourCycle: "h23" });

/** Good morning / afternoon / evening at the hotel, for a moment in ms (Firebase's time) */
export function greeting(nowMs: number) {
  const h = Number(hotelHour.format(nowMs));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

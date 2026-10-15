// Pure calculations for the admin and staff dashboards
import { displayRoomStatus } from "./booking-rules";
import type { Booking, CategoryKey, Payment, Room } from "./types";
import { addDays, hotelDate } from "./utils";

export interface DayRevenue {
  date: string;
  standard: number;
  exclusive: number;
  presidential: number;
}

/** The hotel's calendar day (YYYY-MM-DD, Lagos time) a payment landed on. paidAt is Firebase's server time. */
export const payDay = (p: Pick<Payment, "paidAt">) => hotelDate(Date.parse(p.paidAt));

const categoryLookup = (bookings: Booking[]) => {
  const byBooking = new Map(bookings.map(b => [b.id, b.category] as const));
  return (p: Payment): CategoryKey => p.category ?? byBooking.get(p.bookingId) ?? "standard";
};

/** Revenue per day for the last `days` days (by payment date), split by room category */
export function revenueByDay(payments: Payment[], bookings: Booking[], days: number, today: string): DayRevenue[] {
  const categoryOf = categoryLookup(bookings);
  const start = addDays(today, -(days - 1));
  const out: DayRevenue[] = Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), standard: 0, exclusive: 0, presidential: 0 }));
  const index = new Map(out.map((d, i) => [d.date, i]));
  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    const i = index.get(payDay(p));
    if (i !== undefined) out[i]![categoryOf(p)] += p.amount;
  }
  return out;
}

/** Revenue per calendar month from the first payment to this month, split by room category. `date` is the 1st of the month. */
export function revenueByMonth(payments: Payment[], bookings: Booking[], today: string): DayRevenue[] {
  const ok = payments.filter(p => p.status === "succeeded");
  if (!ok.length) return [];
  const categoryOf = categoryLookup(bookings);
  const first = ok.map(payDay).sort()[0]!;
  const out: DayRevenue[] = [];
  for (let m = first.slice(0, 7); m <= today.slice(0, 7); ) {
    out.push({ date: `${m}-01`, standard: 0, exclusive: 0, presidential: 0 });
    const [y, mo] = m.split("-").map(Number) as [number, number];
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  const index = new Map(out.map((d, i) => [d.date.slice(0, 7), i]));
  for (const p of ok) {
    const i = index.get(payDay(p).slice(0, 7));
    if (i !== undefined) out[i]![categoryOf(p)] += p.amount;
  }
  return out;
}

export interface DayTotal {
  date: string;
  count: number;
  total: number;
  fees: number;
  confirmed: number;
}

/** One row per day that had payments, newest first */
export function dailyTotals(payments: Payment[]): DayTotal[] {
  const days = new Map<string, DayTotal>();
  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    const date = payDay(p);
    const d = days.get(date) ?? { date, count: 0, total: 0, fees: 0, confirmed: 0 };
    d.count += 1;
    d.total += p.amount;
    d.fees += p.processingFee ?? 0;
    if (p.confirmedBy) d.confirmed += 1;
    days.set(date, d);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Payments whose day falls between `from` and `to` (inclusive). Omit both for all time. */
export const paymentsBetween = (payments: Payment[], from?: string, to?: string) =>
  payments.filter(p => {
    const d = payDay(p);
    return (!from || d >= from) && (!to || d <= to);
  });

export function summarisePayments(payments: Payment[]) {
  const ok = payments.filter(p => p.status === "succeeded");
  const total = ok.reduce((n, p) => n + p.amount, 0);
  return {
    count: ok.length,
    total,
    average: ok.length ? total / ok.length : 0,
    fees: ok.reduce((n, p) => n + (p.processingFee ?? 0), 0),
    refunded: payments.filter(p => p.status === "refunded").reduce((n, p) => n + p.amount, 0),
    byMethod: ok.reduce<Record<string, number>>((m, p) => ({ ...m, [p.method ?? "other"]: (m[p.method ?? "other"] ?? 0) + p.amount }), {}),
  };
}

export function sumRevenue(rows: DayRevenue[]) {
  return rows.reduce((n, r) => n + r.standard + r.exclusive + r.presidential, 0);
}

/** Share of rooms with a guest in them right now */
export const occupancy = (rooms: Room[]) => (rooms.length ? rooms.filter(r => r.status === "occupied").length / rooms.length : 0);

/** Average nightly rate across bookings that were paid for */
export function averageNightlyRate(bookings: Booking[]) {
  const paid = bookings.filter(b => ["paid", "confirmed", "checked_in", "checked_out"].includes(b.status));
  const nights = paid.reduce((n, b) => n + b.nights, 0);
  return nights ? paid.reduce((n, b) => n + b.subtotal, 0) / nights : 0;
}

/** Today's front desk numbers */
export function deskSummary(rooms: Room[], bookings: Booking[], today: string) {
  const arrivals = bookings.filter(b => b.checkIn === today && b.status !== "cancelled" && b.status !== "pending_payment");
  const departures = bookings.filter(b => b.checkOut === today && (b.status === "checked_in" || b.status === "checked_out"));
  const statuses = rooms.map(r => displayRoomStatus(r, bookings, today));
  return {
    arrivals: arrivals.length,
    arrivedCount: arrivals.filter(b => b.status === "checked_in" || b.status === "checked_out").length,
    departures: departures.length,
    departedCount: departures.filter(b => b.status === "checked_out").length,
    available: statuses.filter(s => s === "available").length,
    toConfirm: bookings.filter(b => b.status === "paid").length,
  };
}

/** Bookings the desk needs to act on today: arrivals, in-house guests leaving, and paid bookings waiting for confirmation */
export function deskQueue(bookings: Booking[], today: string) {
  const rank: Record<string, number> = { paid: 0, confirmed: 1, checked_in: 2, checked_out: 3 };
  return bookings
    .filter(
      b =>
        (b.checkIn === today && ["paid", "confirmed", "checked_in"].includes(b.status)) ||
        (b.status === "checked_in" && b.checkOut <= today) ||
        (b.checkOut === today && b.status === "checked_out") ||
        (b.status === "paid" && b.checkIn <= addDays(today, 1)),
    )
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.roomNumber - b.roomNumber);
}

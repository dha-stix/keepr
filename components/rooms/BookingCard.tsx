"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Field, Spinner } from "@/components/ui/bits";
import { HOTEL, VAT_RATE } from "@/lib/constants";
import { createBooking, isRoomAvailable } from "@/lib/firebase-actions";
import type { Room } from "@/lib/types";
import { useAsync, useToday } from "@/lib/hooks";
import { addDays, formatDate, naira, nightsBetween, priceStay } from "@/lib/utils";
import { useCategories } from "./CategoriesProvider";

/** Dates, live price and the "Reserve and pay" button for one room */
export function BookingCard({ room }: { room: Room }) {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { categories, ready } = useCategories();
  const c = categories[room.category];
  const min = useToday();
  const [dates, setDates] = useState({ checkIn: params.get("checkIn") ?? "", checkOut: params.get("checkOut") ?? "" });
  const checkIn = dates.checkIn || (min && addDays(min, 1));
  const checkOut = dates.checkOut || (min && addDays(min, 3));
  const setCheckIn = (d: string) => setDates({ checkIn: d, checkOut: checkOut <= d ? addDays(d, 1) : checkOut });
  const setCheckOut = (d: string) => setDates({ checkIn, checkOut: d });
  const [guests, setGuests] = useState(Math.max(1, Math.min(Number(params.get("guests")) || 2, c.maxGuests)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = !!checkIn && !!checkOut && checkOut > checkIn;
  const { data: free } = useAsync(valid ? () => isRoomAvailable(room.id, checkIn, checkOut) : null, `${room.id}|${checkIn}|${checkOut}`);

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const price = priceStay(c.price, Math.max(nights, 0), room.category);

  const reserve = async () => {
    setError("");
    const back = `/rooms/${room.id}?${new URLSearchParams({ checkIn, checkOut, guests: String(guests) })}`;
    if (!user) return router.push(`/auth/login?next=${encodeURIComponent(back)}`);
    if (user.role !== "customer") return setError("Staff and admin accounts can't book rooms. Sign in with a guest account.");
    setBusy(true);
    try {
      const booking = await createBooking({ roomId: room.id, checkIn, checkOut, guests }, user);
      router.push(`/checkout/${booking.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <aside className="card grid gap-3.5 p-5 lg:sticky lg:top-24 md:p-6">
      <div className="num text-sm">
        {ready ? <b className="text-[22px] font-medium">{naira(c.price)}</b> : <span className="skeleton inline-block h-6 w-24 align-middle" />} / night
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in">
          <input
            type="date"
            className="input"
            value={checkIn}
            min={min}
            onChange={e => setCheckIn(e.target.value)}
          />
        </Field>
        <Field label="Check-out">
          <input type="date" className="input" value={checkOut} min={checkIn ? addDays(checkIn, 1) : min} onChange={e => setCheckOut(e.target.value)} />
        </Field>
      </div>
      <Field label="Guests">
        <select className="input" value={guests} onChange={e => setGuests(Number(e.target.value))}>
          {Array.from({ length: c.maxGuests }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-2 text-sm">
        <Row label={`${naira(c.price)} × ${nights} night${nights === 1 ? "" : "s"}`} value={naira(price.subtotal)} />
        <Row label={`VAT (${VAT_RATE * 100}%)`} value={naira(price.vat)} />
        <div className="flex justify-between gap-3 border-t border-dashed border-line pt-3 text-base font-semibold">
          <span>Total</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={price.total} className="num" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              {naira(price.total)}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {free === false && <p className="text-sm text-bad">Room {room.number} is booked for some of those nights. Try other dates or another room.</p>}
      {error && <p className="text-sm text-bad">{error}</p>}

      <button className="btn btn-brass w-full" onClick={reserve} disabled={busy || !ready || free === false || nights < 1}>
        {busy ? (
          <>
            <Spinner /> Holding your room…
          </>
        ) : user ? (
          "Reserve and pay"
        ) : (
          "Sign in to reserve"
        )}
      </button>
      <p className="text-center text-xs text-muted">{checkIn ? `Free cancellation until ${formatDate(addDays(checkIn, -1), { day: "numeric", month: "short" })}, ${HOTEL.checkInTime}` : "Free cancellation up to 24 hours before check-in"}</p>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

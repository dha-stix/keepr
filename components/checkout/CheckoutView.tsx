"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EmptyState, Field, Spinner } from "@/components/ui/bits";
import { Logo } from "@/components/ui/Logo";
import { Ring } from "@/components/ui/motion";
import { AIRPORT_PICKUP_FEE, HOLD_MINUTES } from "@/lib/constants";
import { confirmCheckout, startCheckout, subscribeToBooking, updateBookingDetails } from "@/lib/firebase-actions";
import { holdExpiryMs } from "@/lib/booking-rules";
import { useLive } from "@/lib/hooks";
import type { Booking } from "@/lib/types";
import { HOTEL } from "@/lib/constants";
import { firebaseNow, firebaseTime } from "@/lib/firebase-clock";
import { cx, naira } from "@/lib/utils";
import { Keycard } from "./Keycard";
import { StaySummary } from "./StaySummary";

const ARRIVAL_WINDOWS = [`${HOTEL.checkInTime} – 16:00`, "16:00 – 20:00", "After 20:00"];

export function CheckoutView({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const search = useSearchParams();
  // Bachs sends the guest back to /checkout/[id]?checkout_id=chk_... after paying, or with ?status=cancelled
  const returned = search.get("checkout_id") ? "returned" : search.get("status");
  const { user } = useAuth();
  const { data: booking, loading } = useLive<Booking | null>(cb => subscribeToBooking(bookingId, cb), [bookingId]);

  if (loading) return <Frame step={2}><div className="skeleton h-[420px]" /></Frame>;
  if (!booking || booking.userId !== user?.uid)
    return (
      <Frame step={2}>
        <EmptyState title="We couldn't find that booking">
          It may belong to another account. <Link href="/dashboard/bookings" className="link">See your bookings</Link>
        </EmptyState>
      </Frame>
    );

  const paid = ["paid", "confirmed", "checked_in", "checked_out"].includes(booking.status);
  return (
    <Frame step={paid ? 3 : 2}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-7">
        <AnimatePresence mode="wait">
          {paid ? (
            <Keycard key="done" booking={booking} />
          ) : booking.status === "cancelled" ? (
            <EmptyState key="x" title="This booking was cancelled">
              <Link href="/rooms" className="link">Pick a room again</Link>
            </EmptyState>
          ) : returned === "returned" ? (
            <ConfirmingPayment key="wait" bookingId={booking.id} />
          ) : (
            <PaymentForm key="pay" booking={booking} cancelled={returned === "cancelled"} />
          )}
        </AnimatePresence>
        <StaySummary booking={booking} />
      </div>
    </Frame>
  );
}

function PaymentForm({ booking, cancelled }: { booking: Booking; cancelled: boolean }) {
  const [name, setName] = useState(booking.guestName);
  const [phone, setPhone] = useState(booking.phone ?? "");
  const [arrival, setArrival] = useState(booking.arrivalWindow ?? ARRIVAL_WINDOWS[0]!);
  const [pickup, setPickup] = useState(!!booking.airportPickup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(cancelled ? "Payment was cancelled. Your room is still held until the timer runs out." : "");
  const left = useCountdown(booking.createdAt ? new Date(holdExpiryMs(booking)).toISOString() : undefined);
  const expired = left !== null && left <= 0;
  const pickupIncluded = booking.category === "presidential";

  // Keep the price in the summary in step with the pickup checkbox
  useEffect(() => {
    if (pickup === !!booking.airportPickup || pickupIncluded) return;
    updateBookingDetails(booking, { guestName: name, phone, arrivalWindow: arrival, airportPickup: pickup }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup]);

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\+?[\d\s-]{7,}$/.test(phone)) return setError("Enter a phone number the front desk can reach you on.");
    setBusy(true);
    setError("");
    try {
      await updateBookingDetails(booking, { guestName: name.trim(), phone: phone.trim(), arrivalWindow: arrival, airportPickup: pickup });
      const { redirectUrl } = await startCheckout(booking);
      if (redirectUrl) window.location.assign(redirectUrl);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (expired)
    return (
      <EmptyState title="Your hold has run out">
        Rooms are held for {HOLD_MINUTES} minutes while you pay. <Link href={`/rooms/${booking.roomId}?checkIn=${booking.checkIn}&checkOut=${booking.checkOut}`} className="link">Pick room {booking.roomNumber} again</Link>
      </EmptyState>
    );

  return (
    <motion.form onSubmit={pay} className="card grid gap-4 p-5 md:p-6" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <h2 className="text-xl font-semibold">Guest details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <input className="input" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
        </Field>
        <Field label="Phone">
          <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required autoComplete="tel" placeholder="+234 803 000 0000" />
        </Field>
      </div>
      <Field label="Arrival time">
        <select className="input" value={arrival} onChange={e => setArrival(e.target.value)}>
          {ARRIVAL_WINDOWS.map(w => (
            <option key={w}>{w}</option>
          ))}
        </select>
      </Field>
      <label className={cx("flex items-center gap-2.5 text-sm", pickupIncluded && "text-muted")}>
        <input type="checkbox" className="h-4 w-4 accent-[var(--color-pine)]" checked={pickupIncluded || pickup} disabled={pickupIncluded} onChange={e => setPickup(e.target.checked)} />
        {pickupIncluded ? "Airport pickup is included with Presidential suites" : `Add airport pickup (${naira(AIRPORT_PICKUP_FEE)})`}
      </label>

      <h2 className="mt-2 text-xl font-semibold">Payment</h2>
      <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-pine bg-[color-mix(in_srgb,var(--color-pine)_6%,var(--color-surface))] p-3.5">
        <div>
          <b>Pay with Bachs</b>
          <div className="text-xs text-muted">Card, bank transfer or USSD in a secure window</div>
        </div>
        <span className="pill pill-ok">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure
        </span>
      </div>
      {error && <p className="text-sm text-bad" role="alert">{error}</p>}
      <button className="btn btn-brass w-full" disabled={busy}>
        {busy ? (
          <>
            <Spinner /> Opening secure payment…
          </>
        ) : (
          `Pay ${naira(booking.total)}`
        )}
      </button>
      {left !== null && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <Ring value={left / (HOLD_MINUTES * 60)} size={28} stroke={3.5} color={left < 120 ? "var(--color-bad)" : "var(--color-brass)"} />
          <span>
            Room {booking.roomNumber} is held for you for <b className="num text-ink">{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</b> while you pay.
          </span>
        </div>
      )}
    </motion.form>
  );
}

/**
 * Shown when the guest comes back from Bachs. Asks the server to check the payment with Bachs every few seconds
 * (the Bachs webhook usually gets there first); the booking subscription above switches to the keycard once it's paid.
 */
function ConfirmingPayment({ bookingId }: { bookingId: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    let stopped = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      tries++;
      const status = await confirmCheckout(bookingId).catch(() => "pending_payment");
      if (stopped || status !== "pending_payment") return;
      if (tries === 12) setSlow(true); // about a minute
      if (tries < 60) timer = setTimeout(check, 5000);
    };
    void check();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [bookingId]);
  return (
    <motion.div className="card grid justify-items-center gap-3 p-10 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Spinner className="h-6 w-6 text-pine" />
      <p className="font-semibold">Confirming your payment with Bachs…</p>
      <p className="max-w-sm text-sm text-muted">
        {slow
          ? "Bachs is taking longer than usual. If you paid by bank transfer it can take a few minutes; you can leave this page and check My bookings."
          : "This usually takes a few seconds. This page updates by itself once the payment lands."}
      </p>
    </motion.div>
  );
}

/** Seconds until the given time by Firebase's clock, ticking every second */
function useCountdown(until?: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!until) return;
    let t: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(until).getTime() - firebaseNow()) / 1000)));
    // Wait for Firebase's time first, so a wrong device clock can't show more (or less) time than the hold has
    firebaseTime().then(() => {
      if (stopped) return;
      tick();
      t = setInterval(tick, 1000);
    });
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [until]);
  return left;
}

function Frame({ step, children }: { step: 2 | 3; children: React.ReactNode }) {
  const steps = ["Details", "Payment", "Confirmed"];
  return (
    <div className="container-x grid gap-6 py-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <ol className="flex flex-wrap items-center gap-2 text-[13px]" aria-label="Checkout progress">
          {steps.map((s, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "on" : "todo";
            return (
              <li key={s} className={cx("flex items-center gap-2", state === "todo" ? "text-muted" : "font-semibold")} aria-current={state === "on" ? "step" : undefined}>
                {i > 0 && <span className="h-px w-6 bg-line md:w-9" aria-hidden="true" />}
                <span
                  className={cx(
                    "grid h-6 w-6 place-items-center rounded-full border text-xs transition-colors",
                    state === "done" && "border-brass bg-brass text-[#1a1209]",
                    state === "on" && "border-pine bg-pine text-on-pine",
                    state === "todo" && "border-line",
                  )}
                >
                  {state === "done" ? "✓" : n}
                </span>
                {s}
              </li>
            );
          })}
        </ol>
      </div>
      {children}
    </div>
  );
}

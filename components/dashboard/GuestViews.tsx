"use client";

// The guest dashboard pages. Each one subscribes to the signed-in guest's own data.
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardHeader } from "@/components/layout/DashboardShell";
import { EmptyState, Field, Panel, Spinner, Stat } from "@/components/ui/bits";
import { CountUp } from "@/components/ui/motion";
import { useToast } from "@/components/ui/Toaster";
import { CATEGORIES } from "@/lib/constants";
import { subscribeToMyBookings, subscribeToMyPayments, updateMyProfile } from "@/lib/firebase-actions";
import { useFirebaseTimeValue, useLive, useToday } from "@/lib/hooks";
import type { Booking, Payment } from "@/lib/types";
import { firstName, formatDate, greeting, nairaShort } from "@/lib/utils";
import { BookingsTable } from "./BookingsTable";
import { PaymentsTable } from "./PaymentsTable";
import { StayCard } from "./StayCard";

function useMyBookings() {
  const { user } = useAuth();
  return useLive<Booking[]>(user ? cb => subscribeToMyBookings(user.uid, cb) : null, [user?.uid]);
}

export function GuestOverview() {
  const { user } = useAuth();
  const today = useToday();
  const { data: bookings = [], loading } = useMyBookings();
  const hello = useFirebaseTimeValue(greeting, "Welcome back");

  const upcoming = bookings
    .filter(b => ["pending_payment", "paid", "confirmed", "checked_in"].includes(b.status) && b.checkOut >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const done = bookings.filter(b => b.status === "checked_out");
  const spent = bookings.filter(b => b.paidAt && b.status !== "cancelled").reduce((n, b) => n + b.total, 0);
  const favourite = Object.entries(done.reduce<Record<string, number>>((m, b) => ({ ...m, [b.category]: (m[b.category] ?? 0) + b.nights }), {})).sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <>
      <DashboardHeader
        eyebrow={today ? formatDate(today, { weekday: "long", day: "numeric", month: "long" }) : " "}
        title={`${hello}, ${firstName(user?.name ?? "")}`}
        action={
          <Link href="/rooms" className="btn btn-brass">
            Book a room
          </Link>
        }
      />
      <div className="grid gap-5">
        {loading ? (
          <div className="skeleton h-[240px]" />
        ) : upcoming.length ? (
          upcoming.slice(0, 2).map(b => <StayCard key={b.id} booking={b} today={today} />)
        ) : (
          <EmptyState title="No upcoming stays">
            <Link href="/rooms" className="link">Find a room</Link> for your next trip.
          </EmptyState>
        )}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Stat label="Nights stayed" value={<CountUp value={done.reduce((n, b) => n + b.nights, 0)} />} />
          <Stat label="Total spent" value={<CountUp value={spent} format={nairaShort} />} />
          <Stat label="Bookings" value={<CountUp value={bookings.length} />} />
          <Stat label="Favourite" value={<span className="font-[family-name:var(--font-body)] text-lg">{favourite ? CATEGORIES[favourite as Booking["category"]].name : "—"}</span>} />
        </div>
        <Panel title="Stay history" action={<Link href="/dashboard/bookings" className="link text-sm">See all</Link>}>
          {loading ? <div className="skeleton h-40" /> : <BookingsTable bookings={bookings} variant="guest" limit={5} searchable={false} />}
        </Panel>
      </div>
    </>
  );
}

export function GuestBookings() {
  const { data: bookings, loading } = useMyBookings();
  return (
    <>
      <DashboardHeader eyebrow="Your stays" title="My bookings" action={<Link href="/rooms" className="btn btn-brass">Book a room</Link>} />
      <Panel>{loading ? <div className="skeleton h-60" /> : <BookingsTable bookings={bookings ?? []} variant="guest" />}</Panel>
    </>
  );
}

export function GuestPayments() {
  const { user } = useAuth();
  const { data: payments, loading } = useLive<Payment[]>(user ? cb => subscribeToMyPayments(user.uid, cb) : null, [user?.uid]);
  return (
    <>
      <DashboardHeader eyebrow="Receipts" title="Payments" />
      <Panel>
        {loading ? <div className="skeleton h-60" /> : <PaymentsTable payments={payments ?? []} variant="guest" />}
        <p className="text-xs text-muted">Download a receipt for any paid stay from My bookings.</p>
      </Panel>
    </>
  );
}

export function GuestProfile() {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast("Your name can't be empty.", "error");
    setBusy(true);
    try {
      await updateMyProfile(user.uid, { name: name.trim(), phone: phone.trim() });
      toast("Profile saved");
    } catch {
      toast("Couldn't save your profile. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DashboardHeader eyebrow="Account" title="Profile" />
      <Panel className="max-w-xl">
        <form onSubmit={save} className="grid gap-4">
          <Field label="Full name">
            <input className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Phone (the front desk uses this to reach you)">
            <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="+234 803 000 0000" />
          </Field>
          <Field label="Email (from your Google account)">
            <input className="input bg-paper" value={user.email} readOnly />
          </Field>
          <button className="btn justify-self-start" disabled={busy}>
            {busy && <Spinner />} Save changes
          </button>
        </form>
      </Panel>
    </>
  );
}

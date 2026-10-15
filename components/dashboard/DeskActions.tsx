"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Spinner } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toaster";
import { checkInGuest, checkOutGuest, confirmPayment } from "@/lib/firebase-actions";
import { useToday } from "@/lib/hooks";
import type { Booking } from "@/lib/types";
import { formatDate } from "@/lib/utils";

/**
 * The front desk's next step for a booking. Check-in stays locked until the payment is confirmed,
 * so nobody is lodged without the money being checked, and until the guest's check-in day.
 */
export function DeskActions({ booking: b }: { booking: Booking }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const today = useToday();
  if (!user) return null;
  const actor = { uid: user.uid, name: user.name };

  const run = async (fn: typeof confirmPayment, done: string) => {
    setBusy(true);
    try {
      await fn(b, actor);
      toast(done);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (b.status === "paid")
    return (
      <div className="flex flex-wrap gap-1.5">
        <button className="btn btn-brass btn-sm" disabled={busy} onClick={() => run(confirmPayment, `Payment confirmed for ${b.code}`)}>
          {busy && <Spinner className="h-3 w-3" />} Confirm payment
        </button>
        <button className="btn btn-ghost btn-sm" disabled title="Confirm the payment first">
          Check in
        </button>
      </div>
    );
  if (b.status === "confirmed") {
    // Upcoming guests are listed so the desk can prepare, but check-in opens on their check-in day (hotel time)
    const early = !today || b.checkIn > today;
    return (
      <button
        className="btn btn-sm"
        disabled={busy || early}
        title={early ? `Check-in opens on ${formatDate(b.checkIn, { weekday: "short", day: "numeric", month: "short" })}` : undefined}
        onClick={() => run(checkInGuest, `${b.guestName} checked in to room ${b.roomNumber}`)}
      >
        {busy && <Spinner className="h-3 w-3" />} {early && today ? `Arrives ${formatDate(b.checkIn, { weekday: "short", day: "numeric", month: "short" })}` : "Check in"}
      </button>
    );
  }
  if (b.status === "checked_in")
    return (
      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(checkOutGuest, `${b.guestName} checked out. Room ${b.roomNumber} set to cleaning`)}>
        {busy && <Spinner className="h-3 w-3" />} Check out
      </button>
    );
  if (b.status === "checked_out") return <span className="text-xs text-muted">Room sent to cleaning</span>;
  if (b.status === "pending_payment") return <span className="text-xs text-muted">Waiting for guest to pay</span>;
  return <span className="text-xs text-muted">No action</span>;
}

"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Spinner } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toaster";
import { TRANSITIONS } from "@/lib/booking-rules";
import { cancelBooking } from "@/lib/firebase-actions";
import type { Booking } from "@/lib/types";
import { useToday } from "@/lib/hooks";
import { addDays, cx, formatDate } from "@/lib/utils";

/** Cancel with an inline "are you sure?" step. Free until the day before check-in. */
export function CancelBooking({ booking: b, compact }: { booking: Booking; compact?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = useToday();

  const freeUntil = addDays(b.checkIn, -1);
  if (!user || !today || !TRANSITIONS.cancel.from.includes(b.status) || today > freeUntil) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await cancelBooking(b, { uid: user.uid, name: user.name });
      toast(b.status === "pending_payment" ? "Booking cancelled" : "Booking cancelled. The hotel will refund your payment to your original payment method.");
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
      setAsking(false);
    }
  };

  if (asking)
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
        Cancel {b.code}?
        <button className="btn btn-danger btn-sm" onClick={confirm} disabled={busy}>
          {busy && <Spinner className="h-3 w-3" />} Yes, cancel
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAsking(false)} disabled={busy}>
          Keep it
        </button>
      </span>
    );

  return (
    <button className={cx(compact ? "link text-sm text-bad" : "btn btn-ghost btn-sm")} onClick={() => setAsking(true)}>
      {compact ? "Cancel" : `Cancel (free until ${formatDate(freeUntil)})`}
    </button>
  );
}

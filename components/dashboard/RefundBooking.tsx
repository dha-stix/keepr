"use client";

import { useState } from "react";
import { PasswordCheck, type Pending } from "@/components/admin/PasswordCheck";
import { useAuth } from "@/components/auth/AuthProvider";
import { Spinner } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toaster";
import { refundBooking } from "@/lib/firebase-actions";
import type { Booking } from "@/lib/types";
import { naira } from "@/lib/utils";

/**
 * Refund state of a cancelled, paid booking. Admin managers get a "Refund ₦X" button that asks for their
 * password, then sends the refund through Bachs; everyone else sees where the refund stands.
 */
export function RefundBooking({ booking: b }: { booking: Booking }) {
  const { user } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState<Pending>(null);
  const [sending, setSending] = useState(false);

  if (b.status !== "cancelled" || !b.paidAt) return null;
  if (b.refundStatus === "refunded") return <span className="pill pill-mute">Refunded</span>;
  // Accepted by Bachs (has a refund id); without one the outcome is unknown and the manager may resend it
  if ((b.refundStatus === "processing" && b.refundId) || sending)
    return (
      <span className="pill pill-warn">
        <Spinner className="h-3 w-3" /> Refunding…
      </span>
    );

  const failed = b.refundStatus === "failed" && <span className="pill pill-bad" title={b.refundError}>Refund failed</span>;
  if (user?.role !== "admin")
    return failed || <span className="pill pill-bad">Refund due</span>;

  const amount = naira(b.total);
  const ask = () =>
    setPending({
      title: `Refund ${amount} to ${b.guestName} for ${b.code}`,
      run: async () => {
        setSending(true);
        try {
          await refundBooking(b);
          toast(`Refund of ${amount} sent. Bachs will confirm when it's paid out.`);
        } finally {
          setSending(false);
        }
      },
    });

  return (
    <>
      {failed}
      <button className="btn btn-sm btn-danger" onClick={ask} title={b.refundError}>
        {b.refundStatus ? "Retry refund" : `Refund ${amount}`}
      </button>
      <PasswordCheck pending={pending} onClose={() => setPending(null)} />
    </>
  );
}

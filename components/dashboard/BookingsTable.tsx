"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BookingPill, EmptyState } from "@/components/ui/bits";
import { CATEGORIES } from "@/lib/constants";
import { downloadReceipt } from "@/lib/receipt";
import type { Booking, BookingStatus } from "@/lib/types";
import { cx, naira, stayRange } from "@/lib/utils";
import { CancelBooking } from "./CancelBooking";
import { DeskActions } from "./DeskActions";
import { RefundBooking } from "./RefundBooking";

type Variant = "guest" | "desk";

const FILTERS: { key: string; label: string; match: (s: BookingStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "upcoming", label: "Upcoming", match: s => s === "pending_payment" || s === "paid" || s === "confirmed" },
  { key: "in", label: "In house", match: s => s === "checked_in" },
  { key: "done", label: "Completed", match: s => s === "checked_out" },
  { key: "cancelled", label: "Cancelled", match: s => s === "cancelled" },
];

/**
 * Bookings list with search and status filters.
 * "guest" shows receipts and cancel; "desk" (staff/admin) shows the guest and the next desk action.
 */
export function BookingsTable({ bookings, variant, limit, searchable = true }: { bookings: Booking[]; variant: Variant; limit?: number; searchable?: boolean }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const f = FILTERS.find(x => x.key === filter)!;
    const term = q.trim().toLowerCase();
    return bookings
      .filter(b => f.match(b.status))
      .filter(b => !term || [b.code, b.guestName, b.guestEmail, String(b.roomNumber)].some(v => v.toLowerCase().includes(term)))
      .slice(0, limit);
  }, [bookings, filter, q, limit]);

  return (
    <div className="grid gap-3">
      {searchable && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter bookings">
            {FILTERS.filter(f => variant === "desk" || f.key !== "in").map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cx("rounded-full border px-3 py-1.5 text-xs transition-colors", filter === f.key ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink/40")}
              >
                {f.label}
              </button>
            ))}
          </div>
          {variant === "desk" && (
            <label className="relative ml-auto w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
              <span className="sr-only">Search bookings</span>
              <input className="input pl-9" placeholder="Code, guest or room" value={q} onChange={e => setQ(e.target.value)} />
            </label>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title={bookings.length ? "Nothing matches" : "No bookings yet"}>
          {bookings.length ? "Try another filter." : variant === "guest" ? <Link href="/rooms" className="link">Book your first stay</Link> : "New bookings appear here the moment guests make them."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                {variant === "desk" && <th>Guest</th>}
                <th>Room</th>
                <th>Dates</th>
                <th>Amount</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(b => (
                <tr key={b.id}>
                  <td className="num">{b.code}</td>
                  {variant === "desk" && (
                    <td>
                      <b className="font-semibold">{b.guestName}</b>
                      <div className="text-xs text-muted">{b.phone || b.guestEmail}</div>
                    </td>
                  )}
                  <td>
                    {CATEGORIES[b.category].name} · <span className="num">{b.roomNumber}</span>
                  </td>
                  <td className="num whitespace-nowrap">{stayRange(b.checkIn, b.checkOut)}</td>
                  <td className="num">{naira(b.total)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1">
                      <BookingPill status={b.status} />
                      {/* Paid, then cancelled: money to give back (admin managers refund it here) */}
                      {variant === "desk" && <RefundBooking booking={b} />}
                    </div>
                  </td>
                  <td>
                    {variant === "desk" ? (
                      <DeskActions booking={b} />
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        {b.status === "pending_payment" && (
                          <Link href={`/checkout/${b.id}`} className="link text-sm">
                            Pay now
                          </Link>
                        )}
                        {b.paidAt && (
                          <button className="link text-sm" onClick={() => downloadReceipt(b)}>
                            Receipt
                          </button>
                        )}
                        <CancelBooking booking={b} compact />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

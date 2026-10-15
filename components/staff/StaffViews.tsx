"use client";

// Staff console pages: front desk, room board, bookings and payments
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BookingsTable } from "@/components/dashboard/BookingsTable";
import { DeskActions } from "@/components/dashboard/DeskActions";
import { PaymentsReport } from "@/components/dashboard/PaymentsReport";
import { DashboardHeader } from "@/components/layout/DashboardShell";
import { BookingPill, EmptyState, Panel, Stat } from "@/components/ui/bits";
import { CountUp, Ring } from "@/components/ui/motion";
import { CATEGORIES, STAFF_PAYMENT_DAYS, TOTAL_ROOMS } from "@/lib/constants";
import { useToday } from "@/lib/hooks";
import { deskQueue, deskSummary, paymentsBetween, summarisePayments } from "@/lib/stats";
import type { Booking } from "@/lib/types";
import { formatDate, naira, nairaShort, stayRange } from "@/lib/utils";
import { RoomBoard } from "./RoomBoard";
import { useAllBookings, usePayments, useRooms } from "./useHotelData";

export function FrontDesk() {
  const today = useToday();
  const { data: rooms = [], loading: roomsLoading } = useRooms();
  const { data: bookings = [], loading } = useAllBookings();
  const { data: payments = [] } = usePayments(STAFF_PAYMENT_DAYS);
  const [q, setQ] = useState("");
  const s = deskSummary(rooms, bookings, today);
  const collectedToday = today ? summarisePayments(paymentsBetween(payments, today, today)) : null;
  const queue = useMemo(() => {
    const term = q.trim().toLowerCase();
    // Searching looks through every booking; otherwise show today's work
    if (term) return bookings.filter(b => [b.code, b.guestName, String(b.roomNumber)].some(v => v.toLowerCase().includes(term))).slice(0, 12);
    return today ? deskQueue(bookings, today) : [];
  }, [bookings, today, q]);

  return (
    <>
      <DashboardHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span className="live-dot" /> Live · {today ? formatDate(today, { weekday: "short", day: "numeric", month: "short" }) : ""}
          </span>
        }
        title="Front desk"
        action={
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <span className="sr-only">Find a booking</span>
            <input className="input pl-9" placeholder="Find booking code or guest" value={q} onChange={e => setQ(e.target.value)} />
          </label>
        }
      />
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Stat label="Arrivals today" value={<CountUp value={s.arrivals} />} sub={`${s.arrivedCount} checked in`} />
          <Stat label="Departures today" value={<CountUp value={s.departures} />} sub={`${s.departedCount} checked out`} />
          <Stat label="Rooms available" value={<CountUp value={s.available} />} sub={`of ${TOTAL_ROOMS}`} accent="var(--color-ok)">
            <Ring value={rooms.length ? s.available / rooms.length : 0} label={`${s.available} of ${rooms.length} rooms available`} />
          </Stat>
          <Stat
            label="Payments to confirm"
            value={<CountUp value={s.toConfirm} />}
            sub={collectedToday ? `${nairaShort(collectedToday.total)} collected today (${collectedToday.count})` : "before check-in"}
            accent="var(--color-warn)"
          />
        </div>

        <Panel title={q ? `Results for “${q}”` : "Arrivals and departures"} action={<span className="text-xs text-muted">Confirm payment, then check the guest in</span>}>
          {loading ? <div className="skeleton h-48" /> : <DeskQueue bookings={queue} />}
        </Panel>

        <Panel title="Room board">{roomsLoading ? <div className="skeleton h-64" /> : <RoomBoard rooms={rooms} bookings={bookings} today={today} editable compact />}</Panel>
      </div>
    </>
  );
}

function DeskQueue({ bookings }: { bookings: Booking[] }) {
  if (!bookings.length) return <EmptyState title="All clear">No arrivals or departures waiting on the desk right now.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Guest</th>
            <th>Code</th>
            <th>Room</th>
            <th>Payment</th>
            <th>Stay</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map(b => (
            <tr key={b.id}>
              <td>
                <b className="font-semibold">{b.guestName}</b>
                <div className="text-xs text-muted">{b.arrivalWindow ? `Arriving ${b.arrivalWindow}` : b.phone || b.guestEmail}</div>
              </td>
              <td className="num">{b.code}</td>
              <td>
                <span className="num">{b.roomNumber}</span>
                <div className="text-xs text-muted">{CATEGORIES[b.category].name}</div>
              </td>
              <td>
                {b.status === "paid" ? <span className="pill pill-warn">Paid online · confirm</span> : b.status === "pending_payment" ? <span className="pill pill-mute">Unpaid</span> : <span className="pill pill-ok">Confirmed</span>}
                <div className="num text-xs text-muted">{naira(b.total)}</div>
              </td>
              <td>
                <BookingPill status={b.status} />
                <div className="num text-xs text-muted">{stayRange(b.checkIn, b.checkOut)}</div>
              </td>
              <td>
                <DeskActions booking={b} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StaffRooms() {
  const today = useToday();
  const { data: rooms = [], loading } = useRooms();
  const { data: bookings = [] } = useAllBookings();
  return (
    <>
      <DashboardHeader eyebrow="Housekeeping" title="Room board" />
      <Panel action={<span className="text-xs text-muted">Tap a free or cleaning room to change it</span>}>{loading ? <div className="skeleton h-96" /> : <RoomBoard rooms={rooms} bookings={bookings} today={today} editable />}</Panel>
    </>
  );
}

export function StaffBookings() {
  const { data: bookings = [], loading } = useAllBookings();
  return (
    <>
      <DashboardHeader eyebrow="All guests" title="Bookings" />
      <Panel>{loading ? <div className="skeleton h-96" /> : <BookingsTable bookings={bookings} variant="desk" />}</Panel>
    </>
  );
}

export function StaffPayments() {
  const { data: bookings = [] } = useAllBookings();
  const waiting = bookings.filter(b => b.status === "paid");
  return (
    <>
      <DashboardHeader eyebrow="Received through Bachs" title="Payments" />
      <div className="grid gap-5">
        <Panel title={`Waiting for desk confirmation (${waiting.length})`}>
          {waiting.length ? <BookingsTable bookings={waiting} variant="desk" searchable={false} /> : <EmptyState title="Nothing to confirm">Every online payment has been checked.</EmptyState>}
        </Panel>
        <PaymentsReport scope="staff" />
      </div>
    </>
  );
}

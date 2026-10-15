"use client";

// Admin console pages
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { BookingsTable } from "@/components/dashboard/BookingsTable";
import { PaymentsReport } from "@/components/dashboard/PaymentsReport";
import { PaymentsTable } from "@/components/dashboard/PaymentsTable";
import { DashboardHeader } from "@/components/layout/DashboardShell";
import { RoomBoard } from "@/components/staff/RoomBoard";
import { useActivity, useAllBookings, usePayments, useRooms } from "@/components/staff/useHotelData";
import { EmptyState, Panel, Spinner, Stat } from "@/components/ui/bits";
import { CountUp } from "@/components/ui/motion";
import { useToast } from "@/components/ui/Toaster";
import { seedRooms } from "@/lib/firebase-actions";
import { useToday } from "@/lib/hooks";
import { averageNightlyRate, occupancy, revenueByDay, sumRevenue } from "@/lib/stats";
import { addDays, cx, nairaShort } from "@/lib/utils";
import { RevenueChart } from "./RevenueChart";
import { RoomTypesEditor } from "./RoomTypesEditor";
import { TeamManager } from "./TeamManager";

const RANGES = [7, 14, 30];

export function AdminOverview() {
  const today = useToday();
  const [range, setRange] = useState(14);
  const { data: rooms = [] } = useRooms();
  const { data: bookings = [], loading } = useAllBookings();
  const { data: payments = [] } = usePayments();
  const { data: activity = [] } = useActivity(8);

  const current = today ? revenueByDay(payments, bookings, range, today) : [];
  const previous = today ? revenueByDay(payments, bookings, range, addDays(today, -range)) : [];
  const revenue = sumRevenue(current);
  const prevRevenue = sumRevenue(previous);
  const change = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
  const since = today ? addDays(today, -range) : "";
  const inRange = bookings.filter(b => b.createdAt.slice(0, 10) > since);

  return (
    <>
      <DashboardHeader
        eyebrow={`Last ${range} days`}
        title="Overview"
        action={
          <div className="inline-flex gap-0.5 rounded-full bg-sunk p-[3px]" role="group" aria-label="Date range">
            {RANGES.map(r => (
              <button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className={cx("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", range === r ? "bg-surface text-ink shadow-sm" : "text-muted")}>
                {r}d
              </button>
            ))}
          </div>
        }
      />
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Stat
            label="Revenue"
            value={<CountUp value={revenue} format={nairaShort} />}
            sub={change === null ? "No earlier data" : <span style={{ color: change >= 0 ? "var(--color-ok)" : "var(--color-bad)" }}>{change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs prior {range}d</span>}
          />
          <Stat label="Occupancy now" value={<CountUp value={occupancy(rooms) * 100} format={n => `${Math.round(n)}%`} />} sub={`${rooms.filter(r => r.status === "occupied").length} of ${rooms.length} rooms`} />
          <Stat label="Bookings" value={<CountUp value={inRange.length} />} sub={`${inRange.filter(b => b.status === "cancelled").length} cancelled`} />
          <Stat label="Avg. nightly rate" value={<CountUp value={averageNightlyRate(bookings)} format={nairaShort} />} sub="paid stays" />
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Panel title="Daily revenue" action={<span className="text-xs text-muted">by payment date and room category</span>}>
            {loading ? <div className="skeleton h-56" /> : <RevenueChart data={current} />}
          </Panel>
          <Panel
            title={
              <span className="inline-flex items-center gap-2">
                Live activity <span className="live-dot" />
              </span>
            }
            action={<Link href="/admin/activity" className="link text-sm">All activity</Link>}
          >
            <ActivityFeed entries={activity} />
          </Panel>
        </div>
        <Panel title="Recent payments" action={<Link href="/admin/payments" className="link text-sm">All payments</Link>}>
          <PaymentsTable payments={payments} variant="desk" limit={5} />
        </Panel>
        <Panel title="Team" action={<Link href="/admin/team" className="link text-sm">Manage team</Link>}>
          <TeamManager limit={5} />
        </Panel>
      </div>
    </>
  );
}

export function AdminBookings() {
  const { data: bookings = [], loading } = useAllBookings();
  return (
    <>
      <DashboardHeader eyebrow="Every guest" title="Bookings" />
      <Panel>{loading ? <div className="skeleton h-96" /> : <BookingsTable bookings={bookings} variant="desk" />}</Panel>
    </>
  );
}

export function AdminPayments() {
  return (
    <>
      <DashboardHeader eyebrow="Received through Bachs" title="Payments" />
      <PaymentsReport scope="admin" />
    </>
  );
}

export function AdminRooms() {
  const today = useToday();
  const toast = useToast();
  const { data: rooms = [], loading } = useRooms();
  const { data: bookings = [] } = useAllBookings();
  const [seeding, setSeeding] = useState(false);

  const seed = async () => {
    setSeeding(true);
    try {
      await seedRooms();
      toast("All 66 rooms created");
    } catch {
      toast("Couldn't create the rooms. Check your Firestore rules and that you're an admin.", "error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <DashboardHeader eyebrow="Inventory" title="Rooms and prices" />
      <div className="grid gap-5">
        <RoomTypesEditor />
        <Panel title="All rooms">
          {loading ? (
            <div className="skeleton h-96" />
          ) : rooms.length === 0 ? (
            <EmptyState title="No rooms in Firestore yet">
              Create all 66 rooms (100–230, even numbers) in one go.
              <button className="btn btn-sm mt-3" onClick={seed} disabled={seeding}>
                {seeding && <Spinner />} Create rooms
              </button>
            </EmptyState>
          ) : (
            <RoomBoard rooms={rooms} bookings={bookings} today={today} editable />
          )}
        </Panel>
      </div>
    </>
  );
}

export function AdminTeam() {
  const { user } = useAuth();
  return (
    <>
      <DashboardHeader eyebrow="Staff and admin managers" title="Team" />
      <Panel>{user && <TeamManager />}</Panel>
    </>
  );
}

export function AdminActivity() {
  const { data: activity = [], loading } = useActivity(200);
  return (
    <>
      <DashboardHeader eyebrow="Everything that happened" title="Activity log" />
      <Panel>{loading ? <div className="skeleton h-96" /> : <ActivityFeed entries={activity} fullDates />}</Panel>
    </>
  );
}

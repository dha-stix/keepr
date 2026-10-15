"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { useAllBookings, usePayments } from "@/components/staff/useHotelData";
import { EmptyState, Panel, Stat } from "@/components/ui/bits";
import { CountUp } from "@/components/ui/motion";
import { STAFF_PAYMENT_DAYS } from "@/lib/constants";
import { useToday } from "@/lib/hooks";
import { dailyTotals, paymentsBetween, revenueByDay, revenueByMonth, summarisePayments } from "@/lib/stats";
import { addDays, cx, formatDate, naira, nairaShort } from "@/lib/utils";
import { ExportPaymentsButton, methodLabel, PaymentsTable } from "./PaymentsTable";

type RangeKey = "today" | "day" | "7d" | "30d" | "all";

const RANGES: { key: RangeKey; label: string; adminOnly?: boolean }[] = [
  { key: "today", label: "Today" },
  { key: "day", label: "Pick a day" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days", adminOnly: true },
  { key: "all", label: "All time", adminOnly: true },
];

/**
 * Payments received through Bachs, by day. Staff see today, any single day and the last 7 days;
 * admin managers also get the last 30 days and all time.
 */
export function PaymentsReport({ scope }: { scope: "staff" | "admin" }) {
  const today = useToday();
  const { data: payments = [], loading } = usePayments(scope === "staff" ? STAFF_PAYMENT_DAYS : undefined);
  const { data: bookings = [] } = useAllBookings();
  const ranges = RANGES.filter(r => scope === "admin" || !r.adminOnly);
  const [range, setRange] = useState<RangeKey>(scope === "admin" ? "all" : "today");
  const [day, setDay] = useState("");
  const [q, setQ] = useState("");

  const pickedDay = day || today;
  const period = useMemo((): { from?: string; to?: string; label: string } => {
    if (!today) return { label: "" };
    switch (range) {
      case "today":
        return { from: today, to: today, label: "today" };
      case "day":
        return { from: pickedDay, to: pickedDay, label: formatDate(pickedDay, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) };
      case "7d":
        return { from: addDays(today, -6), to: today, label: "in the last 7 days" };
      case "30d":
        return { from: addDays(today, -29), to: today, label: "in the last 30 days" };
      case "all":
        return { label: "all time" };
    }
  }, [range, today, pickedDay]);

  const inRange = useMemo(() => paymentsBetween(payments, period.from, period.to), [payments, period]);
  const summary = summarisePayments(inRange);
  const days = useMemo(() => dailyTotals(inRange), [inRange]);
  const singleDay = range === "today" || range === "day";
  const chart = useMemo(() => {
    if (!today || singleDay) return null;
    if (range === "all") return { data: revenueByMonth(payments, bookings, today), granularity: "month" as const };
    return { data: revenueByDay(payments, bookings, range === "7d" ? 7 : 30, today), granularity: "day" as const };
  }, [payments, bookings, today, range, singleDay]);

  const term = q.trim().toLowerCase();
  const listed = term ? inRange.filter(p => [p.reference, p.guestName, p.bookingCode].some(v => v.toLowerCase().includes(term))) : inRange;
  const maxDay = Math.max(...days.map(d => d.total), 1);
  const methods = Object.entries(summary.byMethod).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-0.5 rounded-full bg-sunk p-[3px]" role="group" aria-label="Date range">
          {ranges.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} aria-pressed={range === r.key} className={cx("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", range === r.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
              {r.label}
            </button>
          ))}
        </div>
        {range === "day" && (
          <label className="flex items-center gap-2 text-xs text-muted">
            Day
            <input type="date" className="input w-auto py-1.5" value={pickedDay} min={scope === "staff" && today ? addDays(today, -(STAFF_PAYMENT_DAYS - 1)) : undefined} max={today} onChange={e => setDay(e.target.value)} />
          </label>
        )}
        <div className="ml-auto">
          <ExportPaymentsButton payments={inRange} filename={`keepr-payments-${range === "all" ? "all-time" : `${period.from}${period.to !== period.from ? `-to-${period.to}` : ""}`}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Stat label={`Collected ${period.label}`} value={<CountUp key={`t${range}${period.from}`} value={summary.total} format={nairaShort} />} sub={naira(summary.total)} />
        <Stat label="Payments" value={<CountUp key={`c${range}${period.from}`} value={summary.count} />} sub={summary.refunded ? `${naira(summary.refunded)} refunded` : "through Bachs"} />
        <Stat label="Average payment" value={<CountUp key={`a${range}${period.from}`} value={summary.average} format={nairaShort} />} sub="per booking" />
        {scope === "admin" ? (
          <Stat label="Bachs fees" value={<CountUp key={`f${range}${period.from}`} value={summary.fees} format={nairaShort} />} sub={`${naira(summary.total - summary.fees)} settled`} />
        ) : (
          <Stat label="Waiting for desk" value={<CountUp value={bookings.filter(b => b.status === "paid").length} />} sub="paid online, not yet confirmed" accent="var(--color-warn)" />
        )}
      </div>

      {chart && (
        <Panel title={range === "all" ? "Monthly revenue, all time" : "Daily revenue"} action={<span className="text-xs text-muted">by payment date and room category</span>}>
          {loading ? <div className="skeleton h-56" /> : chart.data.length ? <RevenueChart data={chart.data} granularity={chart.granularity} /> : <EmptyState title="No payments yet" />}
        </Panel>
      )}

      <div className={cx("grid items-start gap-5", !singleDay && "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]")}>
        {!singleDay && (
          <Panel title="Daily payments" action={<span className="text-xs text-muted">Pick a day to see its payments</span>}>
            {days.length === 0 ? (
              <EmptyState title="No payments in this period" />
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="table min-w-[460px]">
                  <thead className="sticky top-0 bg-surface">
                    <tr>
                      <th>Day</th>
                      <th>Payments</th>
                      <th>Collected</th>
                      <th>Desk confirmed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(d => (
                      <tr key={d.date} className="cursor-pointer hover:bg-paper" onClick={() => (setDay(d.date), setRange("day"))}>
                        <td className="whitespace-nowrap">
                          {d.date === today ? "Today" : formatDate(d.date, { weekday: "short", day: "numeric", month: "short", ...(range === "all" ? { year: "numeric" } : {}) })}
                        </td>
                        <td className="num">{d.count}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="num w-24 shrink-0">{naira(d.total)}</span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                              <motion.span className="block h-full rounded-full bg-brass" initial={{ width: 0 }} animate={{ width: `${(d.total / maxDay) * 100}%` }} transition={{ duration: 0.7 }} />
                            </span>
                          </div>
                        </td>
                        <td className="num text-muted">
                          {d.confirmed} of {d.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        <Panel title="By payment method">
          {methods.length === 0 ? (
            <p className="text-sm text-muted">No payments {period.label}.</p>
          ) : (
            <ul className="grid gap-3">
              {methods.map(([m, v]) => (
                <li key={m} className="grid gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{methodLabel(m)}</span>
                    <span className="num">{naira(v)}</span>
                  </div>
                  <span className="h-2 overflow-hidden rounded-full bg-sunk">
                    <motion.span className="block h-full rounded-full bg-pine" initial={{ width: 0 }} animate={{ width: `${(v / summary.total) * 100}%` }} transition={{ duration: 0.7 }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title={`Payments ${period.label}${listed.length ? ` (${listed.length})` : ""}`}
        action={
          <label className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
            <span className="sr-only">Search payments</span>
            <input className="input pl-9" placeholder="Guest, booking or reference" value={q} onChange={e => setQ(e.target.value)} />
          </label>
        }
      >
        {loading ? <div className="skeleton h-64" /> : <PaymentsTable payments={listed} variant="desk" />}
      </Panel>
    </div>
  );
}

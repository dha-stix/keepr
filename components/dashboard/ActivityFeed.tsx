"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EmptyState } from "@/components/ui/bits";
import type { ActivityEntry, ActivityType } from "@/lib/types";
import { formatDateTime, formatTime } from "@/lib/utils";

const TONE: Record<ActivityType, string> = {
  booking_created: "var(--color-info)",
  payment_received: "var(--color-info)",
  payment_confirmed: "var(--color-ok)",
  checked_in: "var(--color-ok)",
  checked_out: "var(--color-muted)",
  booking_cancelled: "var(--color-bad)",
  room_status: "var(--color-warn)",
  team_added: "var(--color-ok)",
  team_removed: "var(--color-bad)",
  room_type_updated: "var(--color-brass)",
  payout_account: "var(--color-bad)",
  payment_refunded: "var(--color-bad)",
};

/** Live log of what's happening across the hotel. New entries slide in at the top. */
export function ActivityFeed({ entries, fullDates }: { entries: ActivityEntry[]; fullDates?: boolean }) {
  if (!entries.length) return <EmptyState title="Nothing yet">Bookings, payments and desk actions appear here as they happen.</EmptyState>;
  return (
    <ul className="grid gap-3 text-[13.5px]">
      <AnimatePresence initial={false}>
        {entries.map(e => (
          <motion.li key={e.id} layout initial={{ opacity: 0, y: -10, backgroundColor: "var(--color-brass-soft)" }} animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }} transition={{ duration: 0.6 }} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 rounded-lg">
            <span className="mt-1.5 h-2 w-2 rounded-full" style={{ background: TONE[e.type] }} aria-hidden="true" />
            <span>{e.message}</span>
            <time className="num text-[11.5px] whitespace-nowrap text-muted" dateTime={e.createdAt}>
              {fullDates ? formatDateTime(e.createdAt) : formatTime(e.createdAt)}
            </time>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { DrawnCheck } from "@/components/ui/motion";
import { HOTEL } from "@/lib/constants";
import { downloadReceipt } from "@/lib/receipt";
import type { Booking } from "@/lib/types";
import { formatDate, naira } from "@/lib/utils";

const BURST = Array.from({ length: 18 }, (_, i) => ({ angle: (i / 18) * Math.PI * 2, dist: 90 + (i % 3) * 40, color: ["#a87530", "#e9c88c", "#f2f3ef"][i % 3]! }));

/** Booking confirmation: the guest's booking code on a keycard, with a check mark and a small confetti burst */
export function Keycard({ booking: b }: { booking: Booking }) {
  return (
    <motion.div
      className="relative grid gap-4 overflow-visible rounded-[20px] bg-[linear-gradient(135deg,var(--color-pine),var(--color-pine-deep))] p-6 text-on-pine md:p-7"
      initial={{ opacity: 0, rotateX: 18, y: 30 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ transformPerspective: 900 }}
    >
      <div className="pointer-events-none absolute top-12 left-12" aria-hidden="true">
        {BURST.map((p, i) => (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-[2px]"
            style={{ background: p.color }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(p.angle) * p.dist, y: Math.sin(p.angle) * p.dist + 40, opacity: 0, rotate: 220 }}
            transition={{ duration: 1.3, ease: "easeOut", delay: 0.9 }}
          />
        ))}
      </div>
      <div className="absolute top-6 right-6 h-[30px] w-[42px] rounded-md bg-[linear-gradient(135deg,#e9c88c,var(--color-brass))]" aria-hidden="true" />
      <DrawnCheck />
      <div>
        <small className="text-[11px] tracking-[.12em] uppercase opacity-70">Booking code</small>
        <div className="num text-[30px] tracking-[.12em] md:text-[34px]">{b.code}</div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <small className="block text-[11px] tracking-[.08em] uppercase opacity-70">Check-in</small>
          <b className="num font-medium">
            {formatDate(b.checkIn, { weekday: "short", day: "numeric", month: "short" })} · {HOTEL.checkInTime}
          </b>
        </div>
        <div>
          <small className="block text-[11px] tracking-[.08em] uppercase opacity-70">Check-out</small>
          <b className="num font-medium">
            {formatDate(b.checkOut, { weekday: "short", day: "numeric", month: "short" })} · {HOTEL.checkOutTime}
          </b>
        </div>
      </div>
      <p className="opacity-85">
        Paid {naira(b.total)}. Show this code at the front desk. A staff member confirms your payment and hands you the key to room {b.roomNumber}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard" className="btn btn-brass btn-sm">
          Go to my dashboard
        </Link>
        <button className="btn btn-sm border border-white/30 bg-transparent" onClick={() => downloadReceipt(b)}>
          Download receipt
        </button>
      </div>
    </motion.div>
  );
}

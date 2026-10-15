"use client";

import { motion } from "framer-motion";
import { STAY_STEPS } from "@/lib/constants";
import type { BookingStatus } from "@/lib/types";
import { cx } from "@/lib/utils";

/** Booked → Paid → Desk confirms → Checked in → Checked out, filling in as the stay progresses */
export function StatusTimeline({ status }: { status: BookingStatus }) {
  const reached = STAY_STEPS.findIndex(s => s.status === status);
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Stay progress">
      {STAY_STEPS.map((s, i) => {
        const done = i <= reached;
        const next = i === reached + 1;
        return (
          <li key={s.status} className={cx("grid gap-1.5 text-[10.5px] md:text-[11.5px]", done || next ? "text-ink" : "text-muted")} aria-current={i === reached ? "step" : undefined}>
            <span className="relative block h-1 overflow-hidden rounded-full bg-line">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full bg-brass"
                initial={{ width: 0 }}
                animate={{ width: done ? "100%" : next ? "50%" : 0 }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

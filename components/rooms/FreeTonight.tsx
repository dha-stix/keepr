"use client";

import { useEffect, useState } from "react";
import { getAvailableRooms } from "@/lib/firebase-actions";
import { firebaseTime } from "@/lib/firebase-clock";
import type { CategoryKey } from "@/lib/types";
import { addDays, todayISO } from "@/lib/utils";

/** Live "N free tonight" badge for a room category. Hidden if availability can't be loaded. */
export function FreeTonight({ category }: { category: CategoryKey }) {
  // undefined while loading, null if the lookup failed
  const [free, setFree] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    firebaseTime()
      .then(now => {
        const t = todayISO(now);
        return getAvailableRooms({ checkIn: t, checkOut: addDays(t, 1), category });
      })
      .then(r => setFree(r.length))
      .catch(err => {
        console.error("Couldn't load tonight's availability", err);
        setFree(null);
      });
  }, [category]);
  if (free === undefined) return <span className="skeleton inline-block h-5 w-16" aria-hidden="true" />;
  if (free === null) return null;
  if (free === 0) return <span className="pill pill-bad">Full tonight</span>;
  return <span className={free <= 3 ? "pill pill-warn" : "pill pill-ok"}>{free <= 3 ? `${free} left tonight` : `${free} free tonight`}</span>;
}

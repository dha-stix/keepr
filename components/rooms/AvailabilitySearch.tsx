"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/bits";
import { CATEGORY_LIST } from "@/lib/constants";
import { useToday } from "@/lib/hooks";
import { addDays, cx } from "@/lib/utils";

export interface SearchValues {
  checkIn: string;
  checkOut: string;
  guests: number;
  category: string;
}

/** Date + guests + room type search. Sends the visitor to /rooms with the search in the URL. */
export function AvailabilitySearch({
  initial,
  className,
  onSearch,
  compact,
}: {
  initial?: Partial<SearchValues>;
  className?: string;
  onSearch?: (v: SearchValues) => void;
  /** Four fields in a row with the button underneath, for narrow columns like the hero */
  compact?: boolean;
}) {
  const router = useRouter();
  const [raw, setV] = useState<SearchValues>({ checkIn: "", checkOut: "", guests: 2, category: "all", ...initial });
  // Default dates depend on the visitor's clock: tomorrow for two nights
  const min = useToday();
  const v = { ...raw, checkIn: raw.checkIn || (min && addDays(min, 1)), checkOut: raw.checkOut || (min && addDays(min, 3)) };

  const set = (patch: Partial<SearchValues>) => {
    const next = { ...v, ...patch };
    if (next.checkOut <= next.checkIn) next.checkOut = addDays(next.checkIn, 1);
    setV(next);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (onSearch) return onSearch(v);
    const q = new URLSearchParams({ checkIn: v.checkIn, checkOut: v.checkOut, guests: String(v.guests), category: v.category });
    router.push(`/rooms?${q}`);
  };

  return (
    <form onSubmit={submit} className={cx("card grid grid-cols-2 items-end gap-2.5 p-3.5", compact ? "sm:grid-cols-4" : "md:grid-cols-[repeat(4,minmax(0,1fr))_auto]", className)}>
      <Field label="Check-in">
        <input type="date" className="input" value={v.checkIn} min={min} onChange={e => set({ checkIn: e.target.value })} required />
      </Field>
      <Field label="Check-out">
        <input type="date" className="input" value={v.checkOut} min={v.checkIn ? addDays(v.checkIn, 1) : min} onChange={e => set({ checkOut: e.target.value })} required />
      </Field>
      <Field label="Guests">
        <select className="input" value={v.guests} onChange={e => set({ guests: Number(e.target.value) })}>
          {[1, 2, 3, 4].map(n => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Room">
        <select className="input" value={v.category} onChange={e => set({ category: e.target.value })}>
          <option value="all">Any room</option>
          {CATEGORY_LIST.map(c => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <button className={cx("btn btn-brass col-span-2", compact ? "sm:col-span-4" : "md:col-span-1")}>
        <Search className="h-4 w-4" /> Check availability
      </button>
    </form>
  );
}

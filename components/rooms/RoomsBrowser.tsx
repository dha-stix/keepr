"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/bits";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/constants";
import { getAvailableRooms } from "@/lib/firebase-actions";
import { useAsync } from "@/lib/hooks";
import type { CategoryKey } from "@/lib/types";
import { cx, formatDate, nightsBetween } from "@/lib/utils";
import { AvailabilitySearch, type SearchValues } from "./AvailabilitySearch";
import { useCategories } from "./CategoriesProvider";
import { RoomCard } from "./RoomCard";

/** Rooms shown at first and added by each "Load more" */
const PAGE_SIZE = 20;

export function RoomsBrowser() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { categories, ready } = useCategories();
  const search: SearchValues = {
    checkIn: params.get("checkIn") ?? "",
    checkOut: params.get("checkOut") ?? "",
    guests: Number(params.get("guests") ?? 2),
    category: params.get("category") ?? "all",
  };
  const { data: rooms, error: failed } = useAsync(
    () => getAvailableRooms({ checkIn: search.checkIn || undefined, checkOut: search.checkOut || undefined }),
    `${search.checkIn}|${search.checkOut}`,
  );
  const error = failed ? "We couldn't load rooms right now. Please refresh to try again." : "";

  const update = (patch: Partial<SearchValues>) => {
    const next = { ...search, ...patch };
    const q = new URLSearchParams();
    if (next.checkIn) q.set("checkIn", next.checkIn);
    if (next.checkOut) q.set("checkOut", next.checkOut);
    q.set("guests", String(next.guests));
    q.set("category", next.category);
    router.replace(`${pathname}?${q}`, { scroll: false });
  };

  const visible = useMemo(
    () => (rooms ?? []).filter(r => (search.category === "all" || r.category === search.category) && CATEGORIES[r.category].maxGuests >= search.guests),
    [rooms, search.category, search.guests],
  );
  const nights = search.checkIn && search.checkOut ? nightsBetween(search.checkIn, search.checkOut) : 0;
  const query = params.toString();

  // Back to the first page whenever the search or filters change
  const listKey = `${search.checkIn}|${search.checkOut}|${search.category}|${search.guests}`;
  const [page, setPage] = useState({ key: listKey, count: PAGE_SIZE });
  const count = page.key === listKey ? page.count : PAGE_SIZE;
  const shown = visible.slice(0, count);
  const remaining = visible.length - shown.length;

  return (
    <div className="container-x grid gap-6 pt-6 pb-16">
      <div>
        <div className="eyebrow">
          {nights ? `${formatDate(search.checkIn)} – ${formatDate(search.checkOut)} · ${nights} night${nights > 1 ? "s" : ""} · ${search.guests} guest${search.guests > 1 ? "s" : ""}` : "All rooms · pick dates to check availability"}
        </div>
        <h1 className="display mt-2 text-[36px] md:text-[48px]">{rooms ? `${visible.length} room${visible.length === 1 ? "" : "s"} ${nights ? "free for your dates" : "to choose from"}` : "Finding free rooms…"}</h1>
      </div>

      <AvailabilitySearch key={`${search.checkIn}${search.checkOut}`} initial={search} onSearch={v => update(v)} />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Room type">
        {[{ key: "all", label: "All rooms" }, ...CATEGORY_LIST.map(c => ({ key: c.key, label: ready ? `${c.name} · ₦${Math.round(categories[c.key].price / 1000)}k` : c.name }))].map(f => (
          <button
            key={f.key}
            onClick={() => update({ category: f.key as CategoryKey | "all" })}
            aria-pressed={search.category === f.key}
            className={cx("rounded-full border px-4 py-2 text-[13px] transition-colors", search.category === f.key ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink/40")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-bad">{error}</p>}

      {!rooms && !error ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-[360px]" />
          ))}
        </div>
      ) : visible.length === 0 && !error ? (
        <EmptyState title="No rooms match">Try different dates, fewer guests or another room type.</EmptyState>
      ) : (
        <>
        <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {shown.map((room, i) => (
              <motion.div
                key={room.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                // Stagger within each page, so a newly loaded batch cascades in too
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i % PAGE_SIZE, 8) * 0.04 } }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <RoomCard room={room} query={query} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        <div className="grid justify-items-center gap-3 pt-2">
          <p className="text-sm text-muted" aria-live="polite">
            Showing <span className="num">{shown.length}</span> of <span className="num">{visible.length}</span> rooms
          </p>
          <span className="h-1 w-48 overflow-hidden rounded-full bg-sunk" aria-hidden="true">
            <motion.span className="block h-full rounded-full bg-brass" animate={{ width: `${(shown.length / visible.length) * 100}%` }} transition={{ duration: 0.5 }} />
          </span>
          {remaining > 0 && (
            <button className="btn btn-ghost mt-1" onClick={() => setPage({ key: listKey, count: count + PAGE_SIZE })}>
              Load {Math.min(remaining, PAGE_SIZE)} more room{Math.min(remaining, PAGE_SIZE) === 1 ? "" : "s"}
            </button>
          )}
        </div>
        </>
      )}
    </div>
  );
}

"use client";

import { CATEGORIES, VAT_RATE } from "@/lib/constants";
import type { Booking } from "@/lib/types";
import { formatDate, naira, rateOf, roomPhotos } from "@/lib/utils";
import { useCategories } from "@/components/rooms/CategoriesProvider";
import { RoomImage } from "@/components/rooms/RoomImage";

/** Room photo, dates and price breakdown for a booking */
export function StaySummary({ booking: b }: { booking: Booking }) {
  const c = CATEGORIES[b.category];
  const photos = useCategories().categories[b.category].photos;
  return (
    <aside className="card grid content-start gap-3.5 p-5 md:p-6">
      <div className="relative h-44 overflow-hidden rounded-[var(--radius-card)]">
        <RoomImage src={roomPhotos({ number: b.roomNumber }, photos)[0]!} alt={`${c.name} room ${b.roomNumber}`} fill sizes="(min-width: 1024px) 30vw, 100vw" className="object-cover" />
      </div>
      <h3 className="text-lg font-semibold">
        {c.name} · Room <span className="num">{b.roomNumber}</span>
      </h3>
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {[
          ["Check-in", formatDate(b.checkIn, { weekday: "short", day: "numeric", month: "short" })],
          ["Check-out", formatDate(b.checkOut, { weekday: "short", day: "numeric", month: "short" })],
          ["Guests", String(b.guests)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] tracking-[.08em] text-muted uppercase">{k}</dt>
            <dd className="num">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2 text-sm">
        <Line label={`${naira(rateOf(b))} × ${b.nights} night${b.nights > 1 ? "s" : ""}`} value={naira(b.subtotal)} />
        {b.extras > 0 && <Line label="Airport pickup" value={naira(b.extras)} />}
        <Line label={`VAT (${VAT_RATE * 100}%)`} value={naira(b.vat)} />
        <div className="flex justify-between border-t border-dashed border-line pt-3 text-base font-semibold">
          <span>Total</span>
          <span className="num">{naira(b.total)}</span>
        </div>
      </div>
    </aside>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

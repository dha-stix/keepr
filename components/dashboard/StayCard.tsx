"use client";

import Link from "next/link";
import { BookingPill } from "@/components/ui/bits";
import { CATEGORIES, HOTEL } from "@/lib/constants";
import type { Booking } from "@/lib/types";
import { formatDate, nightsBetween, roomPhotos } from "@/lib/utils";
import { useCategories } from "@/components/rooms/CategoriesProvider";
import { RoomImage } from "@/components/rooms/RoomImage";
import { CancelBooking } from "./CancelBooking";
import { StatusTimeline } from "./StatusTimeline";

/** The guest's current or next stay, with its progress and booking code */
export function StayCard({ booking: b, today }: { booking: Booking; today: string }) {
  const c = CATEGORIES[b.category];
  const photos = useCategories().categories[b.category].photos;
  const days = today ? nightsBetween(today, b.checkIn) : 0;
  const when = b.status === "checked_in" ? "You're staying with us" : days === 0 ? "Arriving today" : days === 1 ? "Next stay · tomorrow" : `Next stay · in ${days} days`;
  return (
    <article className="card grid overflow-hidden md:grid-cols-[300px_minmax(0,1fr)]">
      <div className="relative min-h-[170px] md:min-h-[240px]">
        <RoomImage src={roomPhotos({ number: b.roomNumber }, photos)[0]!} alt={`${c.name} room ${b.roomNumber}`} fill sizes="(min-width: 768px) 300px, 100vw" className="object-cover" />
      </div>
      <div className="grid content-start gap-3.5 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs text-muted">{when}</div>
            <h3 className="display text-[26px] md:text-[28px]">
              {c.name} · Room <span className="num">{b.roomNumber}</span>
            </h3>
          </div>
          <BookingPill status={b.status} />
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            ["Check-in", `${formatDate(b.checkIn, { weekday: "short", day: "numeric", month: "short" })}, ${HOTEL.checkInTime}`],
            ["Check-out", `${formatDate(b.checkOut, { weekday: "short", day: "numeric", month: "short" })}, ${HOTEL.checkOutTime}`],
            ["Booking code", b.code],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] tracking-[.08em] text-muted uppercase">{k}</dt>
              <dd className="num font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <StatusTimeline status={b.status} />
        <div className="flex flex-wrap items-center gap-2">
          {b.status === "pending_payment" ? (
            <Link href={`/checkout/${b.id}`} className="btn btn-brass btn-sm">
              Finish payment
            </Link>
          ) : (
            <Link href={`/checkout/${b.id}`} className="btn btn-sm">
              Show booking code
            </Link>
          )}
          <CancelBooking booking={b} />
        </div>
      </div>
    </article>
  );
}

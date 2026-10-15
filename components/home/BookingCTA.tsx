"use client";

import Link from "next/link";
import { Reveal } from "@/components/ui/motion";
import { HOTEL } from "@/lib/constants";
import { useCategories } from "@/components/rooms/CategoriesProvider";
import { RoomImage } from "@/components/rooms/RoomImage";

/** Background: the Presidential cover photo, so it follows the manager's uploads */
export function BookingCTA() {
  const cover = useCategories().categories.presidential.photos[0];
  return (
    <section className="container-x">
      <Reveal className="relative isolate grid items-center gap-6 overflow-hidden rounded-[26px] px-6 py-10 text-on-pine md:grid-cols-[1.4fr_1fr] md:px-16 md:py-16">
        <RoomImage src={cover} alt="" fill sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-pine-deep)_92%,transparent)_30%,color-mix(in_srgb,var(--color-pine-deep)_45%,transparent))]" />
        <div>
          <h2 className="display text-[36px] md:text-[56px]">Book tonight, sleep well.</h2>
          <p className="mt-3 opacity-85">Free cancellation up to 24 hours before check-in.</p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <Link href="/rooms" className="btn btn-brass">
            Book a room
          </Link>
          <span className="btn btn-ghost cursor-text border-white/30 text-on-pine select-all">Desk: {HOTEL.phone}</span>
        </div>
      </Reveal>
    </section>
  );
}

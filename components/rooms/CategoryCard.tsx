"use client";

import Link from "next/link";
import { roomCountFor } from "@/lib/constants";
import type { CategoryKey } from "@/lib/types";
import { useCategories } from "./CategoriesProvider";
import { FreeTonight } from "./FreeTonight";
import { NightlyPrice } from "./NightlyPrice";
import { RoomImage } from "./RoomImage";

/** One of the three room types, with its cover photo, specs, live price and live availability */
export function CategoryCard({ category }: { category: CategoryKey }) {
  const c = useCategories().categories[category];
  return (
    <article className="card group grid h-full content-start overflow-hidden transition-[transform,box-shadow] duration-500 ease-[var(--ease-keepr)] hover:-translate-y-1.5 hover:shadow-[0_26px_50px_-30px_rgb(0_0_0/.5)]">
      <div className="relative h-60 overflow-hidden md:h-72">
        <RoomImage
          src={c.photos[0]!}
          alt={`${c.name} room`}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover transition-transform duration-[1100ms] ease-[var(--ease-keepr)] group-hover:scale-[1.06]"
        />
      </div>
      <div className="grid gap-2.5 p-5">
        <div className="num text-[11px] tracking-[.1em] text-brass uppercase">
          Rooms {c.range[0]}–{c.range[1]} · {roomCountFor(c)} {c.key === "presidential" ? "suites" : "rooms"}
        </div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="display text-[30px]">{c.name}</h3>
          <FreeTonight category={c.key} />
        </div>
        <p className="text-sm text-muted">{c.blurb}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="chip">{c.size}</span>
          <span className="chip">{c.bed}</span>
          <span className="chip">Up to {c.maxGuests} guests</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <NightlyPrice category={c.key} from />
          <Link href={`/rooms?category=${c.key}`} className="btn btn-sm">
            View rooms
          </Link>
        </div>
      </div>
    </article>
  );
}

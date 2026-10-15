"use client";

import Link from "next/link";
import type { Room } from "@/lib/types";
import { roomPhotos } from "@/lib/utils";
import { useCategories } from "./CategoriesProvider";
import { NightlyPrice } from "./NightlyPrice";
import { RoomImage } from "./RoomImage";

export function RoomCard({ room, query }: { room: Room; query?: string }) {
  const c = useCategories().categories[room.category];
  return (
    <Link
      href={`/rooms/${room.id}${query ? `?${query}` : ""}`}
      className="card group grid h-full content-start overflow-hidden transition-[transform,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-[0_26px_50px_-30px_rgb(0_0_0/.5)]"
    >
      <div className="relative h-52 overflow-hidden">
        <RoomImage src={roomPhotos(room, c.photos)[0]!} alt={`${c.name} room ${room.number}`} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-[1100ms] group-hover:scale-[1.06]" />
      </div>
      <div className="grid gap-2 p-5">
        <div className="num text-[11px] tracking-[.1em] text-brass uppercase">{c.name}</div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="display text-2xl">
            Room <span className="num text-[0.8em]">{room.number}</span>
          </h3>
          <span className="pill pill-ok">Free</span>
        </div>
        <p className="text-sm text-muted">{room.wing}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <NightlyPrice category={room.category} />
          <span className="btn btn-sm">View</span>
        </div>
      </div>
    </Link>
  );
}

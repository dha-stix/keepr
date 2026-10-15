"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Room } from "@/lib/types";
import { roomPhotos } from "@/lib/utils";
import { useCategories } from "./CategoriesProvider";
import { RoomImage } from "./RoomImage";
import { useCallback, useEffect, useState } from "react";

/** Photo grid that opens a swipeable full-screen lightbox */
export function RoomGallery({ room, title }: { room: Pick<Room, "number" | "category">; title: string }) {
  const photos = roomPhotos(room, useCategories().categories[room.category].photos);
  const [open, setOpen] = useState<number | null>(null);
  const go = useCallback((d: number) => setOpen(i => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, go]);

  return (
    <>
      <div className="grid grid-cols-[2fr_1fr] grid-rows-[150px_100px] gap-2.5 md:grid-rows-[220px_220px]">
        {photos.slice(0, 3).map((p, i) => (
          <button key={i} onClick={() => setOpen(i)} className={`group relative overflow-hidden rounded-[var(--radius-card)] ${i === 0 ? "row-span-2" : ""}`} aria-label={`Open photo ${i + 1} of ${photos.length}`}>
            <RoomImage src={p} alt={`${title}, photo ${i + 1}`} fill priority={i === 0} sizes="(min-width: 1024px) 40vw, 60vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            {i === 2 && photos.length > 3 && <span className="absolute inset-0 grid place-items-center bg-black/35 text-sm font-medium text-white">+{photos.length - 3} more</span>}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={`${title} photos`}>
            <motion.div
              key={open}
              className="relative aspect-[3/2] w-full max-w-5xl"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => Math.abs(info.offset.x) > 80 && go(info.offset.x < 0 ? 1 : -1)}
              onClick={e => e.stopPropagation()}
            >
              <RoomImage src={photos[open]!} alt={`${title}, photo ${open + 1}`} fill sizes="100vw" className="rounded-xl object-contain" />
            </motion.div>
            <span className="num absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/80">
              {open + 1} / {photos.length}
            </span>
            {[
              { d: -1, Icon: ChevronLeft, cls: "left-3", label: "Previous photo" },
              { d: 1, Icon: ChevronRight, cls: "right-3", label: "Next photo" },
            ].map(({ d, Icon, cls, label }) => (
              <button key={d} className={`absolute top-1/2 ${cls} grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25`} onClick={e => (e.stopPropagation(), go(d))} aria-label={label}>
                <Icon className="h-5 w-5" />
              </button>
            ))}
            <button className="absolute top-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white" onClick={() => setOpen(null)} aria-label="Close photos">
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

"use client";

import Link from "next/link";
import { useCategories } from "@/components/rooms/CategoriesProvider";
import { RoomImage } from "@/components/rooms/RoomImage";
import { SectionHeading } from "@/components/ui/bits";
import { CountUp, Reveal } from "@/components/ui/motion";
import { photoAt } from "@/lib/categories";
import type { CategoryKey, Photo } from "@/lib/types";
import { images } from "@/images";

/** Each tile shows a room type photo by position (0 = cover), so managers' uploads appear here automatically */
const TILES: { type?: CategoryKey; position?: number; alt: string; cls: string }[] = [
  { type: "presidential", position: 1, alt: "Presidential suite", cls: "col-span-2 md:col-span-1 md:row-span-2" },
  { alt: "Hotel exterior and pool", cls: "" },
  { type: "exclusive", position: 1, alt: "Exclusive room", cls: "" },
  { type: "standard", position: 1, alt: "Standard room", cls: "" },
  { type: "presidential", position: 2, alt: "Presidential suite living room", cls: "" },
];

export function Gallery() {
  const { categories } = useCategories();
  return (
    <section id="gallery" className="container-x scroll-mt-20 pb-16 md:pb-24">
      <SectionHeading eyebrow="Gallery" title="Take a look around" />
      <Reveal className="grid auto-rows-[130px] grid-cols-2 gap-3 md:auto-rows-[250px] md:grid-cols-[2fr_1fr_1fr]">
        {TILES.map(t => {
          const src: Photo = t.type ? photoAt(categories[t.type], t.position!) : images.exterior;
          const label = t.type ? `${categories[t.type].name} rooms →` : t.alt;
          const cls = `group relative block overflow-hidden rounded-[var(--radius-card)] bg-sunk ${t.cls}`;
          const body = (
            <>
              <RoomImage src={src} alt={t.alt} fill sizes="(min-width: 768px) 40vw, 50vw" className="object-cover transition-transform duration-[1100ms] group-hover:scale-105" />
              <span className="absolute bottom-3 left-3 rounded-md bg-black/40 px-2 py-1 text-xs text-white backdrop-blur transition-all duration-300 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">{label}</span>
            </>
          );
          return t.type ? (
            <Link key={t.alt} href={`/rooms?category=${t.type}`} className={cls} aria-label={`See ${categories[t.type].name} rooms`}>
              {body}
            </Link>
          ) : (
            <div key={t.alt} className={cls}>
              {body}
            </div>
          );
        })}
      </Reveal>

      <div className="mt-14 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <blockquote className="display text-[26px] leading-tight italic md:text-[36px]">
            “Paid on my phone in the taxi, showed the code at the desk, and I was upstairs in two minutes.”
            <cite className="mt-4 block font-[family-name:var(--font-body)] text-sm text-muted not-italic">Adaeze O. · stayed in an Exclusive room, Sept 2026</cite>
          </blockquote>
        </Reveal>
        <Reveal delay={0.1} className="grid grid-cols-2 gap-3">
          <div className="card p-5">
            <div className="display text-[44px] leading-none">
              <CountUp value={4.8} decimals={1} />
            </div>
            <p className="mt-1 text-sm text-muted">average from 1,240 reviews</p>
          </div>
          <div className="card p-5">
            <div className="display text-[44px] leading-none">
              <CountUp value={2} /> min
            </div>
            <p className="mt-1 text-sm text-muted">median check-in at the desk</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

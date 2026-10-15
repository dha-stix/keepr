"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { RoomImage } from "@/components/rooms/RoomImage";
import { useRef } from "react";
import { AvailabilitySearch } from "@/components/rooms/AvailabilitySearch";
import { HOTEL, TOTAL_ROOMS } from "@/lib/constants";
import { images } from "@/images";

const ease = [0.2, 0.8, 0.2, 1] as const;
const rise = (delay: number) => ({ initial: { opacity: 0, y: 26 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, ease, delay } });

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  return (
    <section ref={ref} className="container-x grid items-center gap-8 pt-4 pb-12 md:pt-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-20">
      <div>
        <motion.div className="eyebrow" {...rise(0)}>
          Lekki · {TOTAL_ROOMS} rooms · Front desk open 24/7
        </motion.div>
        <h1 className="display mt-4 text-[46px] sm:text-[64px] xl:text-[84px]">
          {["Your room is", "ready", "before you arrive."].map((part, i) => (
            <motion.span key={part} className={i === 1 ? "inline-block pr-3 text-brass italic" : "inline-block pr-3"} {...rise(0.1 + i * 0.12)}>
              {part}
            </motion.span>
          ))}
        </h1>
        <motion.p className="mt-5 max-w-[44ch] text-base text-muted md:text-lg" {...rise(0.45)}>
          Pick a room, pay online and walk straight to your key. No queue at the desk, no phone calls to confirm.
        </motion.p>
        <motion.div {...rise(0.6)}>
          <AvailabilitySearch compact className="mt-8 rounded-[18px]" />
        </motion.div>
      </div>

      <motion.div className="relative h-[320px] sm:h-[440px] lg:h-[600px]" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease, delay: 0.15 }}>
        <div className="absolute inset-0 overflow-hidden rounded-[26px]">
          <motion.div className="absolute inset-[-6%_0]" style={{ y: photoY }}>
            <RoomImage src={images.heroNight} alt="Keepr hotel pool and lobby at dusk" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="animate-kenburns object-cover" />
          </motion.div>
        </div>
        <motion.div className="animate-floaty absolute top-4 left-3 z-10 rounded-2xl bg-surface px-4 py-3 text-[13px] shadow-[0_18px_40px_-18px_rgb(0_0_0/.45)] lg:top-20 lg:-left-8" {...rise(0.9)}>
          <span className="live-dot mr-1.5" />
          <b className="text-[15px]">Room 164</b>
          <span className="block text-muted">Exclusive · ready for you</span>
        </motion.div>
        <motion.div
          className="animate-floaty absolute right-3 bottom-4 z-10 flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[13px] shadow-[0_18px_40px_-18px_rgb(0_0_0/.45)] [animation-delay:-2.5s] lg:right-6 lg:bottom-14"
          {...rise(1.05)}
        >
          <Clock />
          <div>
            <span className="text-muted">Check-in from</span>
            <b className="num block text-[15px]">{HOTEL.checkInTime}</b>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/** A small clock whose minute hand sweeps continuously */
function Clock() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="15" fill="none" stroke="var(--color-line)" strokeWidth="2" />
      <line x1="17" y1="17" x2="23" y2="17" stroke="var(--color-brass)" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="17" y1="17" x2="17" y2="7" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 17 17" to="360 17 17" dur="6s" repeatCount="indefinite" />
      </line>
      <circle cx="17" cy="17" r="2" fill="var(--color-ink)" />
    </svg>
  );
}

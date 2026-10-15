"use client";

import { animate, motion, useInView, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

const ease = [0.2, 0.8, 0.2, 1] as const;

/** Fades content up as it scrolls into view. Content is visible without JS (initial only applies after hydration). */
export function Reveal({ children, delay = 0, y = 28, className, ...rest }: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Staggers its direct <StaggerItem> children in */
export function Stagger({ children, className, gap = 0.08 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} transition={{ staggerChildren: gap }} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={reduce ? undefined : { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Counts a number up from zero the first time it's seen.
 * Server components pass `decimals`; client components can pass a `format` function.
 */
export function CountUp({ value, decimals = 0, format, className }: { value: number; decimals?: number; format?: (n: number) => string; className?: string }) {
  const fmt = format ?? ((n: number) => n.toLocaleString("en-NG", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(value);
  const started = useRef(false);
  useEffect(() => {
    if (!inView) return;
    const from = started.current ? shown : 0;
    started.current = true;
    const controls = animate(from, value, { duration: 1.1, ease, onUpdate: setShown });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value]);
  return (
    <span ref={ref} className={className}>
      {fmt(shown)}
    </span>
  );
}

/** SVG progress ring. value is 0–1; animates whenever it changes. */
export function Ring({ value, size = 44, stroke = 5, color = "var(--color-ok)", label }: { value: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunk)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: Math.max(0, Math.min(1, value)) }}
        transition={{ duration: 1, ease }}
      />
    </svg>
  );
}

/** A check mark in a circle that draws itself */
export function DrawnCheck({ size = 56, ring = "var(--color-brass)", tick = "var(--color-on-pine)" }: { size?: number; ring?: string; tick?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <motion.circle cx="28" cy="28" r="25" fill="none" stroke={ring} strokeWidth="2.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease }} />
      <motion.path
        d="M16 29l8 8 16-17"
        fill="none"
        stroke={tick}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease, delay: 0.55 }}
      />
    </svg>
  );
}

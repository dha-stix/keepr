"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "@/components/ui/bits";
import { Stagger, StaggerItem } from "@/components/ui/motion";

const STEPS = [
  { title: "Sign in with Google", body: "One tap. Your bookings and receipts stay in one place." },
  { title: "Choose and pay", body: "Pick your room and dates, then pay securely online with Bachs." },
  { title: "Show your code", body: "Give the front desk your booking code. They confirm and hand you the key." },
];

const PATH = "M10 60 C 200 0, 250 0, 444 60 S 690 120, 878 60 S 1150 10, 1270 40";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container-x scroll-mt-20 pb-16 md:pb-24">
      <SectionHeading eyebrow="How it works" title="From search to key in three steps" />
      {/* The route between the steps draws itself, then a dot keeps travelling it */}
      <svg viewBox="0 0 1280 90" className="mb-2 hidden h-auto w-full overflow-visible md:block" aria-hidden="true">
        <motion.path
          d={PATH}
          fill="none"
          stroke="var(--color-brass)"
          strokeWidth="1.5"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2.4, ease: [0.2, 0.8, 0.2, 1] }}
        />
        {[10, 444, 878].map(x => (
          <circle key={x} cx={x} cy="60" r="8" fill="var(--color-paper)" stroke="var(--color-brass)" strokeWidth="2" />
        ))}
        <circle r="6" fill="var(--color-pine)">
          <animateMotion dur="7s" repeatCount="indefinite" path={PATH} />
        </circle>
      </svg>
      <Stagger className="grid gap-6 md:grid-cols-3" gap={0.15}>
        {STEPS.map((s, i) => (
          <StaggerItem key={s.title} className="grid gap-2 border-t-2 border-brass pt-6">
            <span className="display text-[56px] leading-none text-brass">{i + 1}</span>
            <h4 className="text-lg font-semibold">{s.title}</h4>
            <p className="text-muted">{s.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

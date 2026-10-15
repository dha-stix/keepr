import Link from "next/link";
import { cx } from "@/lib/utils";

/** The Keepr wordmark: a brass keycard with a light sweep across it */
export function Logo({ href = "/", className, light }: { href?: string; className?: string; light?: boolean }) {
  return (
    <Link href={href} className={cx("display inline-flex items-center gap-2 text-[24px] font-semibold tracking-tight", light && "text-on-pine", className)} aria-label="Keepr home">
      <svg width="22" height="30" viewBox="0 0 22 30" aria-hidden="true" className="shrink-0">
        <defs>
          <linearGradient id="keepr-shine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="keepr-card">
            <rect width="22" height="30" rx="5" />
          </clipPath>
        </defs>
        <rect width="22" height="30" rx="5" fill="var(--color-brass)" />
        <rect x="6" y="6" width="10" height="3" rx="1.5" fill="var(--color-paper)" />
        <g clipPath="url(#keepr-card)">
          <rect x="-14" y="-4" width="12" height="40" fill="url(#keepr-shine)" transform="rotate(18)">
            <animate attributeName="x" values="-14;30;30" keyTimes="0;0.35;1" dur="5s" repeatCount="indefinite" />
          </rect>
        </g>
      </svg>
      Keepr
    </Link>
  );
}

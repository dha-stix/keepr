// Small presentational pieces reused across pages
import { BOOKING_STATUS, ROOM_STATUS } from "@/lib/constants";
import type { BookingStatus, RoomStatus } from "@/lib/types";
import { cx } from "@/lib/utils";
import type { ReactNode } from "react";

export function BookingPill({ status }: { status: BookingStatus }) {
  const s = BOOKING_STATUS[status];
  return <span className={cx("pill", s.pill)}>{s.label}</span>;
}

export function RoomPill({ status }: { status: RoomStatus }) {
  const s = ROOM_STATUS[status];
  return <span className={cx("pill", s.pill)}>{s.label}</span>;
}

export function SectionHeading({ eyebrow, title, aside, className }: { eyebrow: string; title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10", className)}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="display mt-2 max-w-[16ch] text-[34px] md:text-[54px]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("field", className)}>
      {label}
      {children}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} aria-hidden="true" />;
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("card grid min-w-0 content-start gap-4 p-4 md:p-5", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--color-brass)" strokeWidth="1.6" className="svg-draw-in" aria-hidden="true">
        <path pathLength={1} d="M8 40V18l16-10 16 10v22" />
        <path pathLength={1} d="M18 40V28h12v12" />
      </svg>
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, accent, children }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; children?: ReactNode }) {
  return (
    <div className="card relative grid gap-1 p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="num text-[22px] font-medium md:text-[26px]" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
      {children && <div className="absolute top-3.5 right-3.5">{children}</div>}
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BedDouble,
  CalendarDays,
  ConciergeBell,
  CreditCard,
  Landmark,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Search,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Logo } from "@/components/ui/Logo";
import { ROLE_LOGIN } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { cx, initials } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Navigation for each role's console, in one place */
export const NAV: Record<Role, NavItem[]> = {
  customer: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/rooms", label: "Book a room", icon: Search },
    { href: "/dashboard/bookings", label: "My bookings", icon: CalendarDays },
    { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
    { href: "/dashboard/profile", label: "Profile", icon: User },
  ],
  staff: [
    { href: "/staff/dashboard", label: "Front desk", icon: ConciergeBell },
    { href: "/staff/rooms", label: "Room board", icon: BedDouble },
    { href: "/staff/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/staff/payments", label: "Payments", icon: CreditCard },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/payouts", label: "Bank details", icon: Landmark },
    { href: "/admin/rooms", label: "Rooms", icon: BedDouble },
    { href: "/admin/team", label: "Team", icon: Users },
    { href: "/admin/activity", label: "Activity log", icon: Activity },
    { href: "/staff/dashboard", label: "Front desk", icon: ConciergeBell },
  ],
};

const ROLE_LABEL: Record<Role, string> = { customer: "Guest", staff: "Front desk", admin: "Admin manager" };

/** Sidebar on desktop, bottom tab bar on phones. Used by all three dashboards. */
export function DashboardShell({ nav, children }: { nav: Role; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const items = NAV[nav];
  const primary = items.length > 5 ? items.slice(0, 4) : items;
  const overflow = items.length > 5 ? items.slice(4) : [];
  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const leave = async () => {
    const login = ROLE_LOGIN[user?.role ?? "customer"];
    await signOut();
    router.replace(user?.role === "customer" ? "/" : login);
  };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-surface px-3.5 py-5 md:flex">
        <Logo className="mx-1.5 mb-5 text-[22px]" />
        <nav className="grid gap-1" aria-label="Dashboard">
          {items.map(({ href, label, icon: Icon }) => {
            const on = isActive(href);
            return (
              <Link key={href} href={href} className={cx("relative flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-sm transition-colors", on ? "font-semibold text-ink" : "text-muted hover:bg-paper hover:text-ink")}>
                {on && <motion.span layoutId="nav-active" className="absolute inset-0 -z-0 rounded-[9px] bg-sunk" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-line pt-3 text-[13px]">
          <Avatar name={user?.name ?? ""} photo={user?.photoURL} />
          <div className="min-w-0 flex-1">
            <b className="block truncate">{user?.name}</b>
            <span className="text-xs text-muted">{ROLE_LABEL[user?.role ?? "customer"]}</span>
          </div>
          <button onClick={leave} className="rounded-md p-2 text-muted hover:bg-paper hover:text-bad" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Phone header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo className="text-[21px]" />
        <div className="flex items-center gap-2">
          <Avatar name={user?.name ?? ""} photo={user?.photoURL} />
          <button onClick={leave} className="rounded-md p-2 text-muted" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="min-w-0 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>

      {/* Phone tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-surface px-1.5 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] md:hidden" aria-label="Dashboard">
        {primary.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cx("grid min-w-0 flex-1 justify-items-center gap-1 text-[10.5px]", isActive(href) ? "font-semibold text-pine" : "text-muted")}>
            <Icon className="h-5 w-5" />
            <span className="max-w-full truncate">{label.split(" ")[0]}</span>
          </Link>
        ))}
        {overflow.length > 0 && (
          <button onClick={() => setMore(true)} className={cx("grid flex-1 justify-items-center gap-1 text-[10.5px]", overflow.some(i => isActive(i.href)) ? "font-semibold text-pine" : "text-muted")}>
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        )}
      </nav>

      <AnimatePresence>
        {more && (
          <motion.div className="fixed inset-0 z-50 bg-black/40 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div
              className="absolute inset-x-0 bottom-0 grid gap-1 rounded-t-3xl bg-surface p-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              onClick={e => e.stopPropagation()}
            >
              <span className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
              {overflow.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-paper">
                  <Icon className="h-5 w-5 text-muted" />
                  {label}
                </Link>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Avatar({ name, photo, size = 32 }: { name: string; photo?: string | null; size?: number }) {
  if (photo) return <Image src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full" />;
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-brass-soft text-[13px] font-bold text-brass" style={{ width: size, height: size }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Page title row used at the top of every dashboard page */
export function DashboardHeader({ eyebrow, title, action }: { eyebrow?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="display mt-1.5 text-[30px] md:text-[38px]">{title}</h1>
      </div>
      {action}
    </div>
  );
}

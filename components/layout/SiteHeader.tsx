"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Logo } from "@/components/ui/Logo";
import { ROLE_HOME } from "@/lib/constants";
import { cx } from "@/lib/utils";

const LINKS = [
  { href: "/rooms", label: "Rooms" },
  { href: "/#services", label: "Services" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#gallery", label: "Gallery" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const account = user ? (
    <Link href={ROLE_HOME[user.role]} className="btn btn-sm" onClick={() => setOpen(false)}>
      My dashboard
    </Link>
  ) : (
    <>
      <Link href="/auth/login" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
        Sign in
      </Link>
      <Link href="/rooms" className="btn btn-sm" onClick={() => setOpen(false)}>
        Book a room
      </Link>
    </>
  );

  return (
    <header
      className={cx(
        "sticky top-0 z-50 transition-[background,box-shadow,backdrop-filter] duration-300",
        scrolled ? "bg-paper/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="container-x flex items-center justify-between gap-4 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted lg:flex" aria-label="Main">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className="relative transition-colors hover:text-ink after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-brass after:transition-[width] after:duration-300 hover:after:w-full">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">{account}</div>
        <button className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-pine-deep text-on-pine lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="container-x flex items-center justify-between py-4">
              <Logo light />
              <button className="grid h-10 w-10 place-items-center rounded-full border border-white/20" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <motion.nav className="container-x mt-6 grid gap-1" initial="h" animate="s" transition={{ staggerChildren: 0.06, delayChildren: 0.1 }} aria-label="Mobile">
              {LINKS.map(l => (
                <motion.div key={l.href} variants={{ h: { opacity: 0, y: 20 }, s: { opacity: 1, y: 0 } }}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="display block border-b border-white/10 py-4 text-[34px]">
                    {l.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div variants={{ h: { opacity: 0 }, s: { opacity: 1 } }} className="mt-8 flex flex-wrap gap-3 [&_.btn-ghost]:border-white/25 [&_.btn-ghost]:text-on-pine">
                {account}
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

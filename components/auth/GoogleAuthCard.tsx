"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GoogleIcon, Spinner } from "@/components/ui/bits";
import { Logo } from "@/components/ui/Logo";
import { ROLE_HOME, TOTAL_ROOMS } from "@/lib/constants";
import { signInWithGoogle } from "@/lib/firebase-actions";
import { useCategories } from "@/components/rooms/CategoriesProvider";
import { RoomImage } from "@/components/rooms/RoomImage";
import { photoAt } from "@/lib/categories";
import type { CategoryKey } from "@/lib/types";
import { safeNext } from "@/lib/utils";
import { useAuth } from "./AuthProvider";

const COPY = {
  login: {
    eyebrow: "Guest sign in",
    title: "Good to see you again",
    lede: "Sign in to see your bookings, pay for a stay or download receipts.",
    button: "Continue with Google",
    quote: "Welcome back. Your room has been aired out for you.",
    photo: { type: "presidential" as CategoryKey, position: 2 }, // 3rd Presidential photo
    switchText: "New here?",
    switchLink: { href: "/auth/register", label: "Create an account" },
  },
  register: {
    eyebrow: "Create your account",
    title: "Stay with us in a few taps",
    lede: "Use your Google account. No passwords to remember.",
    button: "Sign up with Google",
    quote: `${TOTAL_ROOMS} rooms. One tap to book any of them.`,
    photo: { type: "exclusive" as CategoryKey, position: 2 }, // 3rd Exclusive photo
    switchText: "Already have an account?",
    switchLink: { href: "/auth/login", label: "Sign in" },
  },
};

const PERKS = [`Book any of our ${TOTAL_ROOMS} rooms in under a minute`, "Every receipt saved to your account", "Skip the paperwork at the front desk"];

/** Split-screen Google sign in / sign up used by /auth/login and /auth/register */
export function GoogleAuthCard({ mode }: { mode: "login" | "register" }) {
  const c = COPY[mode];
  const photo = photoAt(useCategories().categories[c.photo.type], c.photo.position);
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in: go where they were heading, or to their dashboard
  useEffect(() => {
    if (!user) return;
    router.replace(user.role === "customer" ? safeNext(next, ROLE_HOME.customer) : ROLE_HOME[user.role]);
  }, [user, next, router]);

  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === "auth/popup-closed-by-user" ? "The Google window was closed before you finished. Try again." : "Google sign-in didn't work. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative isolate flex min-h-[260px] flex-col justify-between overflow-hidden p-6 text-[#f7f2e8] md:p-11">
        <AnimatePresence mode="popLayout">
          <motion.div key={mode} className="absolute inset-0 -z-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <RoomImage src={photo} alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="animate-kenburns object-cover" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(10_20_17/.35),rgb(10_20_17/.1)_40%,rgb(10_20_17/.75))]" />
        <Logo light />
        <motion.blockquote key={c.quote} className="display max-w-[16ch] text-[26px] leading-tight italic md:text-[38px]" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          {c.quote}
        </motion.blockquote>
      </div>

      <div className="grid place-items-center px-5 py-10">
        <motion.div key={mode} className="grid w-full max-w-[400px] gap-[18px]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
          <div className="eyebrow">{c.eyebrow}</div>
          <h1 className="display text-[38px] md:text-[46px]">{c.title}</h1>
          <p className="text-muted">{c.lede}</p>
          <button
            onClick={go}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-[15px] font-medium transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-16px_rgb(0_0_0/.4)] disabled:opacity-60"
          >
            {busy ? <Spinner /> : <GoogleIcon />}
            {busy ? "Waiting for Google…" : c.button}
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
          {mode === "register" && (
            <ul className="grid gap-2.5 text-sm">
              {PERKS.map(p => (
                <li key={p} className="flex items-center gap-2.5">
                  <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-brass-soft text-xs font-bold text-brass">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted">
            {c.switchText}{" "}
            <Link href={`${c.switchLink.href}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">
              {c.switchLink.label}
            </Link>
          </p>
          <p className="text-xs text-muted">By continuing you agree to the Terms and the Privacy Policy.</p>
        </motion.div>
      </div>
    </div>
  );
}

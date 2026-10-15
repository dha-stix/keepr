"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Field, Spinner } from "@/components/ui/bits";
import { Logo } from "@/components/ui/Logo";
import { ROLE_HOME } from "@/lib/constants";
import { signInWithEmail } from "@/lib/firebase-actions";
import { cx, safeNext } from "@/lib/utils";
import { useAuth } from "./AuthProvider";

const COPY = {
  staff: { badge: "FRONT DESK CONSOLE", title: "Start your shift", button: "Sign in to front desk", note: "Guests sign in on the main site with Google." },
  admin: { badge: "ADMIN MANAGER", title: "Manager sign in", button: "Sign in to admin", note: "Admin accounts are created by another admin manager." },
};

const MAX_TRIES = 5;
const COOLDOWN_S = 30;

/** Email + password sign-in for /staff/login and /admin/login */
export function ConsoleLogin({ role }: { role: "staff" | "admin" }) {
  const c = COPY[role];
  const { user } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [tries, setTries] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!user) return;
    const home = ROLE_HOME[user.role];
    router.replace(user.role !== "customer" && safeNext(next, "").startsWith(`/${role}/`) ? next! : home);
  }, [user, next, role, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (cooldown) return;
    setBusy(true);
    setError("");
    try {
      await signInWithEmail(email.trim(), password, role);
    } catch (err) {
      const n = tries + 1;
      setTries(n);
      setShake(s => s + 1);
      if (n >= MAX_TRIES) {
        setCooldown(COOLDOWN_S);
        setTries(0);
        setError(`Too many attempts. Try again in ${COOLDOWN_S} seconds.`);
      } else setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-pine-deep px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_50%_40%,#000_0%,transparent_70%)]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--color-on-pine) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-on-pine) 6%, transparent) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
        aria-hidden="true"
      />
      <motion.form
        key={shake}
        onSubmit={submit}
        className={cx("relative grid w-full max-w-[420px] gap-4 rounded-[20px] bg-surface p-6 shadow-[0_40px_80px_-30px_rgb(0_0_0/.6)] md:p-8", shake > 0 && "animate-shake")}
        initial={shake ? false : { opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Logo />
        <span className="num inline-flex items-center gap-2 justify-self-start rounded-md bg-brass-soft px-2.5 py-1 text-[11.5px] text-brass">● {c.badge}</span>
        <h1 className="display text-[34px]">{c.title}</h1>
        <Field label="Work email">
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required placeholder="you@keepr.com" />
        </Field>
        <Field label="Password" className="relative">
          <input type={show ? "text" : "password"} className="input pr-16" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 bottom-[7px] flex items-center gap-1 rounded-md bg-sunk px-2 py-1 text-xs text-muted" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {show ? "Hide" : "Show"}
          </button>
        </Field>
        {error && (
          <p className="text-sm text-bad" role="alert">
            {cooldown ? `Too many attempts. Try again in ${cooldown}s.` : error}
          </p>
        )}
        <button className="btn w-full" disabled={busy || cooldown > 0}>
          {busy && <Spinner />}
          {busy ? "Signing in…" : c.button}
        </button>
        <p className="text-xs text-muted">{`${c.note} Forgot your password? Ask an admin manager to reset it.`}</p>
      </motion.form>
    </div>
  );
}

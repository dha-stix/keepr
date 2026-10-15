"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field, Spinner } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toaster";
import { confirmPassword } from "@/lib/firebase-actions";

/** A money action waiting for the manager to re-enter their password */
export type Pending = { title: string; run: () => Promise<void> } | null;

/** "Confirm it's you" step before any change to where money goes */
export function PasswordCheck({ pending, onClose }: { pending: Pending; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setPassword("");
    setError("");
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      await confirmPassword(password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      return;
    }
    try {
      await pending.run();
      close();
    } catch (err) {
      toast((err as Error).message, "error");
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {pending && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/45 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && close()}>
          <motion.form
            onSubmit={submit}
            onClick={e => e.stopPropagation()}
            className="grid w-full max-w-sm gap-4 rounded-2xl bg-surface p-6 shadow-2xl"
            initial={{ y: 20, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pw-title"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-brass-soft text-brass">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h3 id="pw-title" className="text-lg font-semibold">
                Confirm it&rsquo;s you
              </h3>
              <p className="mt-1 text-sm text-muted">{pending.title}. Enter your password to continue.</p>
            </div>
            <Field label="Password">
              <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
            </Field>
            {error && <p className="text-sm text-bad">{error}</p>}
            <div className="flex gap-2">
              <button className="btn flex-1" disabled={busy}>
                {busy && <Spinner />} Confirm
              </button>
              <button type="button" className="btn btn-ghost" onClick={close} disabled={busy}>
                Cancel
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

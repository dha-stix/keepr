"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Avatar } from "@/components/layout/DashboardShell";
import { Field, Spinner } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toaster";
import { createTeamMember, deleteTeamMember, subscribeToTeam, type NewTeamMember } from "@/lib/firebase-actions";
import { useLive } from "@/lib/hooks";
import type { AppUser } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const BLANK: NewTeamMember = { name: "", email: "", role: "staff", password: "" };

/** Admin managers add and remove staff and other admin managers */
export function TeamManager({ limit }: { limit?: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: team = [], loading } = useLive<AppUser[]>(subscribeToTeam, []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewTeamMember>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  if (!user) return null;
  const actor = { uid: user.uid, name: user.name };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createTeamMember({ ...form, name: form.name.trim(), email: form.email.trim() });
      toast(`${form.name} added. Share their temporary password with them directly.`);
      setForm(BLANK);
      setAdding(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: AppUser) => {
    setRemoving(m.uid);
    try {
      await deleteTeamMember(m, actor);
      toast(`${m.name} removed`);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setRemoving(null);
      setConfirming(null);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <button className="btn btn-sm" onClick={() => setAdding(a => !a)} aria-expanded={adding}>
          <Plus className="h-3.5 w-3.5" /> Add member
        </button>
      </div>
      <AnimatePresence initial={false}>
        {adding && (
          <motion.form onSubmit={add} className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="grid items-end gap-3 rounded-xl bg-sunk p-4 md:grid-cols-[1.2fr_1.4fr_0.9fr_1fr_auto]">
              <Field label="Full name">
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ibrahim Sule" required />
              </Field>
              <Field label="Work email">
                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ibrahim.s@keepr.com" required />
              </Field>
              <Field label="Role">
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as NewTeamMember["role"] })}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin manager</option>
                </select>
              </Field>
              <Field label="Temporary password">
                <input className="input" type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={8} required autoComplete="new-password" />
              </Field>
              <button className="btn btn-brass" disabled={busy}>
                {busy && <Spinner />} Add
              </button>
              {error && <p className="text-sm text-bad md:col-span-5">{error}</p>}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="skeleton h-48" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last active</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {team.slice(0, limit).map(m => (
                  <motion.tr key={m.uid} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 20 }}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={m.name} photo={m.photoURL} size={28} />
                        <b className="font-semibold">{m.name}</b>
                        {m.uid === user.uid && <span className="pill pill-mute">You</span>}
                      </span>
                    </td>
                    <td>{m.email}</td>
                    <td>
                      <span className={m.role === "admin" ? "pill pill-warn" : "pill pill-info"}>{m.role === "admin" ? "Admin manager" : "Staff"}</span>
                    </td>
                    <td className="num text-muted">{m.lastActive ? formatDateTime(m.lastActive) : "Not signed in yet"}</td>
                    <td className="text-right">
                      {m.uid === user.uid ? null : confirming === m.uid ? (
                        <span className="inline-flex flex-wrap items-center justify-end gap-1.5 text-xs">
                          Remove {m.name.split(" ")[0]}?
                          <button className="btn btn-danger btn-sm" onClick={() => remove(m)} disabled={removing === m.uid}>
                            {removing === m.uid && <Spinner className="h-3 w-3" />} Remove
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button className="link text-sm text-bad" onClick={() => setConfirming(m.uid)}>
                          Remove
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

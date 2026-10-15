"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Check, Landmark, Lock, Pencil, Plus, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardHeader } from "@/components/layout/DashboardShell";
import { EmptyState, Field, Panel, Spinner, Stat } from "@/components/ui/bits";
import { PasswordCheck, type Pending } from "./PasswordCheck";
import { useToast } from "@/components/ui/Toaster";
import {
  addPayoutAccount,
  getPayoutOverview,
  listBanks,
  lookupBankAccount,
  removePayoutAccount,
  renamePayoutAccount,
  setDefaultPayoutAccount,
} from "@/lib/firebase-actions";
import type { BachsBalance, Bank, BankDestination, ResolvedAccount } from "@/lib/types";
import { cx, formatDateTime, naira } from "@/lib/utils";

/**
 * Admin managers manage the bank accounts the hotel's Bachs balance pays out to.
 * Adding, removing or changing the default account asks for the manager's password first.
 */
export function PayoutAccounts() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<{ destinations: BankDestination[]; balances: BachsBalance[] } | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);

  const load = useCallback(async () => {
    try {
      setData(await getPayoutOverview());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let live = true;
    getPayoutOverview().then(
      d => live && setData(d),
      e => live && setError((e as Error).message),
    );
    return () => {
      live = false;
    };
  }, []);

  // While Bachs is reviewing an account, check back regularly so the status updates by itself
  const reviewing = data?.destinations.some(d => d.status === "pending_review");
  useEffect(() => {
    if (!reviewing) return;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [reviewing, load]);

  if (!user) return null;
  const ngn = data?.balances.find(b => b.currency === "NGN");

  /** Runs a sensitive change after the password check */
  const guarded = (title: string, fn: () => Promise<void>, done: string) =>
    setPending({
      title,
      run: async () => {
        await fn();
        toast(done);
        await load();
      },
    });

  return (
    <>
      <DashboardHeader eyebrow="Bachs payouts" title="Bank details" action={!adding && <button className="btn" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add bank account</button>} />
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <Stat label="Available to pay out" value={ngn ? naira(ngn.available) : data ? "—" : <span className="skeleton inline-block h-7 w-28" />} sub="NGN balance on Bachs" accent="var(--color-ok)" />
          <Stat label="Still settling" value={ngn ? naira(ngn.pending) : data ? "—" : <span className="skeleton inline-block h-7 w-24" />} sub="becomes available after settlement" />
          <div className="card col-span-2 flex items-start gap-3 p-4 text-sm text-muted">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-brass" />
            <p>
              Send money out from the Bachs dashboard (<b className="text-ink">Balances → Withdraw</b>), or switch on automatic payouts there. Automatic payouts go to the <b className="text-ink">default</b> account below.
            </p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {adding && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <AddAccountForm
                onCancel={() => setAdding(false)}
                onSubmit={(input, label) =>
                  guarded(`Add ${label}`, async () => {
                    await addPayoutAccount(input);
                    setAdding(false);
                  }, "Bank account added. Bachs will review it before it can receive payouts.")
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        <Panel title="Payout accounts">
          {error ? (
            <EmptyState title="Couldn't load bank details">{error}</EmptyState>
          ) : !data ? (
            <div className="grid gap-3">
              <div className="skeleton h-24" />
              <div className="skeleton h-24" />
            </div>
          ) : data.destinations.length === 0 ? (
            <EmptyState title="No bank account yet">Add the hotel&rsquo;s bank account so Bachs can pay out your balance.</EmptyState>
          ) : (
            <ul className="grid gap-3">
              <AnimatePresence initial={false}>
                {data.destinations.map(d => (
                  <AccountRow
                    key={d.id}
                    account={d}
                    onRename={name => renamePayoutAccount(d.id, name).then(load)}
                    onMakeDefault={() => guarded(`Make ${d.bankName} ••${d.accountLast4} the default`, () => setDefaultPayoutAccount(d.id), "Default payout account updated")}
                    onRemove={() => guarded(`Remove ${d.bankName} ••${d.accountLast4}`, () => removePayoutAccount(d.id), "Bank account removed")}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
          <p className="text-xs text-muted">
            To change an account number, add the new account and remove the old one. Bachs reviews every new account, and only approved accounts can receive money. Every change here is recorded in the activity log.
          </p>
        </Panel>
      </div>

      <PasswordCheck pending={pending} onClose={() => setPending(null)} />
    </>
  );
}

const STATUS = {
  approved: { label: "Approved", pill: "pill-ok" },
  pending_review: { label: "In review by Bachs", pill: "pill-warn" },
  rejected: { label: "Rejected", pill: "pill-bad" },
};

function AccountRow({ account: d, onRename, onMakeDefault, onRemove }: { account: BankDestination; onRename: (name: string) => Promise<void>; onMakeDefault: () => void; onRemove: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(d.name);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onRename(name);
      toast("Account renamed");
      setEditing(false);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} className={cx("grid gap-3 rounded-xl border p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center", d.isDefault ? "border-brass bg-brass-soft/40" : "border-line")}>
      <span className="grid h-11 w-11 place-items-center rounded-full bg-sunk text-pine">
        <Landmark className="h-5 w-5" />
      </span>
      <div className="grid min-w-0 gap-1">
        {editing ? (
          <form onSubmit={saveName} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`name-${d.id}`}>
              Account name in Keepr
            </label>
            <input id={`name-${d.id}`} className="input w-56 py-1.5" value={name} onChange={e => setName(e.target.value)} maxLength={80} autoFocus />
            <button className="btn btn-sm" disabled={saving}>
              {saving ? <Spinner className="h-3 w-3" /> : <Check className="h-3.5 w-3.5" />} Save
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => (setEditing(false), setName(d.name))}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <b className="truncate">{d.name}</b>
            <button className="rounded p-1 text-muted hover:text-ink" onClick={() => setEditing(true)} aria-label={`Rename ${d.name}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {d.isDefault && (
              <span className="pill bg-brass text-[#1a1209]">
                <BadgeCheck className="h-3.5 w-3.5" /> Default
              </span>
            )}
            <span className={cx("pill", STATUS[d.status].pill)}>
              {d.status === "pending_review" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
              {STATUS[d.status].label}
            </span>
          </div>
        )}
        <p className="text-sm">
          {d.bankName} · <span className="num">••{d.accountLast4}</span> · {d.accountName}
        </p>
        <p className="text-xs text-muted">
          {d.status === "rejected" ? (
            <span className="text-bad">{d.statusReason || "Bachs rejected this account. Add the account again with correct details."}</span>
          ) : d.reviewedAt ? (
            `Approved ${formatDateTime(d.reviewedAt)}`
          ) : (
            `Added ${formatDateTime(d.createdAt)} · usually reviewed within 48 hours`
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        {confirmRemove ? (
          <span className="flex flex-wrap items-center gap-1.5 text-xs">
            {d.isDefault ? "This is the default account. Remove it?" : "Remove this account?"}
            <button className="btn btn-danger btn-sm" onClick={() => (setConfirmRemove(false), onRemove())}>
              Remove
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(false)}>
              Keep
            </button>
          </span>
        ) : (
          <>
            {!d.isDefault && d.isUsable && (
              <button className="btn btn-sm" onClick={onMakeDefault}>
                Make default
              </button>
            )}
            <button className="btn btn-ghost btn-sm text-bad" onClick={() => setConfirmRemove(true)}>
              Remove
            </button>
          </>
        )}
      </div>
    </motion.li>
  );
}

function AddAccountForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (input: { bankCode: string; accountNumber: string; name: string }, label: string) => void }) {
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [bankError, setBankError] = useState("");
  const [query, setQuery] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [name, setName] = useState("Keepr operating account");
  const [lookup, setLookup] = useState<{ key: string; result?: ResolvedAccount; error?: string } | null>(null);

  useEffect(() => {
    listBanks().then(setBanks, e => setBankError((e as Error).message));
  }, []);

  const filtered = useMemo(() => (banks ?? []).filter(b => b.name.toLowerCase().includes(query.trim().toLowerCase())), [banks, query]);
  const bank = banks?.find(b => b.code === bankCode);
  const key = `${bankCode}|${accountNumber}`;
  const ready = !!bankCode && accountNumber.length === 10;

  // Look the account up as soon as the bank and all 10 digits are in
  useEffect(() => {
    if (!ready) return;
    let live = true;
    lookupBankAccount(bankCode, accountNumber).then(
      result => live && setLookup({ key, result }),
      e => live && setLookup({ key, error: (e as Error).message }),
    );
    return () => {
      live = false;
    };
  }, [ready, bankCode, accountNumber, key]);

  const current = lookup?.key === key ? lookup : null;
  const verified = !!current?.result?.resolved;

  return (
    <form
      className="card grid gap-4 p-5 md:p-6"
      onSubmit={e => {
        e.preventDefault();
        if (verified && bank) onSubmit({ bankCode, accountNumber, name }, `${bank.name} ••${accountNumber.slice(-4)}`);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Add a bank account</h3>
        <button type="button" className="rounded p-1 text-muted hover:text-ink" onClick={onCancel} aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Bank">
          {bankError ? (
            <p className="text-sm text-bad">{bankError}</p>
          ) : (
            <div className="grid gap-1.5">
              <input className="input" placeholder={banks ? "Search banks" : "Loading banks…"} value={query} onChange={e => setQuery(e.target.value)} disabled={!banks} aria-label="Search banks" />
              <select className="input" value={bankCode} onChange={e => setBankCode(e.target.value)} disabled={!banks} required size={Math.min(5, Math.max(filtered.length, 2))}>
                {filtered.map(b => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Field>
        <div className="grid content-start gap-4">
          <Field label="Account number (10 digits)">
            <input className="input num text-lg tracking-widest" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="0123456789" required />
          </Field>
          <div className="min-h-[44px] rounded-lg bg-paper px-3 py-2.5 text-sm" aria-live="polite">
            {!ready ? (
              <span className="text-muted">Pick the bank and type the account number to check the account name.</span>
            ) : !current ? (
              <span className="flex items-center gap-2 text-muted">
                <Spinner /> Checking with the bank…
              </span>
            ) : verified ? (
              <span className="flex items-center gap-2 font-semibold text-ok">
                <BadgeCheck className="h-4 w-4" /> {current.result!.accountName}
              </span>
            ) : (
              <span className="flex items-center gap-2 text-bad">
                <ShieldAlert className="h-4 w-4" /> {current.error ?? current.result?.message ?? "No account found. Check the bank and number."}
              </span>
            )}
          </div>
          <Field label="Name in Keepr">
            <input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
          </Field>
        </div>
      </div>
      <p className="text-xs text-muted">Make sure the account name above is the hotel&rsquo;s. Bachs only pays out to accounts that belong to the account holder, and reviews each new account before it can be used.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-brass" disabled={!verified}>
          <Lock className="h-4 w-4" /> Add account
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

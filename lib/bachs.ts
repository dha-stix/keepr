// Server-side Bachs integration (https://docs.bachs.io).
// This is the only file that talks to Bachs. Built against:
//   - Create a checkout session: POST /v1/checkout-sessions  (raw `pricing` amount, no catalog products needed)
//   - Webhook signatures: X-Bachs-Signature-V2 "t=<unix>,v1=<hex>" = HMAC-SHA256(secret, "<t>.<raw body>")
//   - Fulfil on `collection.succeeded` (status SUCCEEDED / ACCEPTED / OVERPAID), dedupe by event id
//   - Refunds: POST /v1/refunds, finished by refund.paid / refund.failed webhooks
// Money is a decimal string in major units ("204250.00"), never kobo.
import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./firebase-admin";
import type { BachsBalance, Bank, BankDestination, RefundStatus, ResolvedAccount } from "./types";

/** Sandbox until you set BACHS_API_URL=https://api.bachs.io with an sk_live_ key */
const API_URL = process.env.BACHS_API_URL ?? "https://sandbox-api.bachs.io";
const SECRET_KEY = process.env.BACHS_SECRET_KEY;
const WEBHOOK_SECRET = process.env.BACHS_WEBHOOK_SECRET;
const SIGNATURE_TOLERANCE_S = 300;

export const isBachsConfigured = Boolean(SECRET_KEY);

/** Naira amount as Bachs expects it */
export const toBachsAmount = (naira: number) => naira.toFixed(2);

export interface CheckoutRequest {
  bookingId: string;
  bookingCode: string;
  amount: number; // naira
  customer: { name: string; email: string; phone?: string };
  successUrl: string;
  cancelUrl: string;
  /** Matches the room hold so nobody can pay after the room is released */
  expiresInMinutes: number;
}

export interface CheckoutSession {
  checkoutId: string;
  checkoutUrl: string;
  expiresAt?: string;
}

export async function createCheckoutSession(req: CheckoutRequest): Promise<CheckoutSession> {
  if (!SECRET_KEY) throw new HttpError(503, "Payments are not set up yet. Add BACHS_SECRET_KEY on the server.");

  const phone = req.customer.phone?.replace(/[^\d+]/g, "");
  const res = await fetch(`${API_URL}/v1/checkout-sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      pricing: { currency: "NGN", amount: toBachsAmount(req.amount) },
      customer: { email: req.customer.email, name: req.customer.name, ...(phone ? { phone_number: phone } : {}) },
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      // `reference` must be unique forever, and a guest may retry payment, so add the attempt time
      reference: `${req.bookingCode}-${Date.now().toString(36)}`,
      metadata: { bookingId: req.bookingId, bookingCode: req.bookingCode },
      expires_in_minutes: Math.min(1440, Math.max(1, Math.ceil(req.expiresInMinutes))),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof body.checkout_url !== "string") {
    console.error("Bachs checkout session failed", res.status, body);
    const msg = typeof body.message === "string" ? body.message : "The payment provider couldn't start this payment. Please try again.";
    throw new HttpError(502, msg);
  }
  return { checkoutId: String(body.checkout_id), checkoutUrl: body.checkout_url, expiresAt: body.expires_at as string | undefined };
}

/**
 * Verifies a webhook came from Bachs. Prefers X-Bachs-Signature-V2 (accepts any v1= value, which keeps
 * deliveries valid while a secret is being rotated) and falls back to X-Bachs-Timestamp + X-Bachs-Signature.
 */
export function verifyWebhook(rawBody: string, headers: Headers): boolean {
  if (!WEBHOOK_SECRET) return false;
  let timestamp: string | undefined;
  let signatures: string[] = [];

  const v2 = headers.get("x-bachs-signature-v2");
  if (v2) {
    for (const part of v2.split(",")) {
      const [k, v] = part.split("=", 2).map(s => s?.trim());
      if (k === "t") timestamp = v;
      if (k === "v1" && v) signatures.push(v);
    }
  } else {
    timestamp = headers.get("x-bachs-timestamp") ?? undefined;
    const v1 = headers.get("x-bachs-signature");
    if (v1) signatures = [v1];
  }
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_S) return false; // stale: likely a replay

  const expected = Buffer.from(createHmac("sha256", WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`, "utf8").digest("hex"));
  return signatures.some(s => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** The parts of a `collection.succeeded` event Keepr uses */
export interface CollectionEvent {
  eventId: string;
  createdAt: string;
  status: "SUCCEEDED" | "ACCEPTED" | "OVERPAID" | string;
  bookingId?: string;
  checkoutId?: string;
  chargeId?: string;
  amount: number;
  currency: string;
  settlementAmount?: number;
  processingFee?: number;
  method?: string;
}

/** Statuses Bachs says to fulfil on (still subject to our own amount check) */
export const PAID_STATUSES = ["SUCCEEDED", "ACCEPTED", "OVERPAID"];

export function parseCollectionEvent(event: Record<string, unknown>): CollectionEvent | null {
  if (event.type !== "collection.succeeded") return null;
  const d = (event.data ?? {}) as Record<string, unknown>;
  const metadata = (d.metadata ?? {}) as Record<string, unknown>;
  const pm = (d.payment_method_details ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  return {
    eventId: String(event.id),
    createdAt: String(event.created_at ?? new Date().toISOString()),
    status: String(d.status ?? "").toUpperCase(),
    bookingId: typeof metadata.bookingId === "string" ? metadata.bookingId : undefined,
    checkoutId: typeof d.checkout_id === "string" ? d.checkout_id : undefined,
    chargeId: typeof d.charge_id === "string" ? d.charge_id : undefined,
    amount: num(d.amount) ?? 0,
    currency: String(d.currency ?? ""),
    settlementAmount: num(d.settlement_amount),
    processingFee: num(d.processing_fee),
    method: typeof pm.type === "string" ? pm.type : undefined,
  };
}

/**
 * Asks Bachs whether a checkout session was paid (GET /v1/checkout-sessions/{id}). Returns the payment in the same
 * shape as a collection.succeeded event, or null while it isn't paid yet.
 */
export async function getCheckoutPayment(checkoutId: string): Promise<CollectionEvent | null> {
  const session = await bachs<Record<string, unknown>>(`/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`);
  const charge = (session.charge ?? null) as Record<string, unknown> | null;
  if (String(session.payment_status ?? "").toLowerCase() !== "succeeded" || !charge) return null;
  const metadata = (session.metadata ?? {}) as Record<string, unknown>;
  const fees = (charge.fees ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  return {
    // Same charge, so the payment doc (keyed by charge id) is shared with the webhook's
    eventId: `checkout-${checkoutId}`,
    createdAt: String(charge.completed_at ?? session.completed_at ?? ""),
    status: String(charge.status ?? "").toUpperCase(),
    bookingId: typeof metadata.bookingId === "string" ? metadata.bookingId : undefined,
    checkoutId: String(session.checkout_id ?? checkoutId),
    chargeId: typeof charge.payment_id === "string" ? charge.payment_id : undefined,
    amount: num(charge.amount_paid) ?? num(charge.amount) ?? 0,
    currency: String(charge.currency ?? ""),
    processingFee: num(fees.amount),
    method: typeof charge.payment_method === "string" ? charge.payment_method : undefined,
  };
}

/* ===================================================== PAYOUT ACCOUNTS (bank details)
 * Docs: Payouts → Create a payout, API reference → Payout Destinations, Reference → List banks,
 * Misc → Resolve a bank account, Balances → Retrieve balances.
 * Your Bachs key needs the payouts:read, payouts:write and balance:read scopes.
 */

async function bachs<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!SECRET_KEY) throw new HttpError(503, "Bachs is not set up yet. Add BACHS_SECRET_KEY on the server.");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = String(body.error_code ?? body.code ?? "");
    const detail = typeof body.detail === "string" ? body.detail : typeof body.message === "string" ? body.message : "";
    console.error("Bachs request failed", path, res.status, code, detail);
    const friendly: Record<string, string> = {
      BANK_ROUTING_DETAILS_INVALID: "Bachs couldn't verify that bank and account number. Check both and try again.",
      PAYOUT_CURRENCY_NOT_ENABLED: "NGN payouts aren't enabled on this Bachs account yet. Contact Bachs support.",
      NOT_FOUND: "That bank account no longer exists on Bachs.",
    };
    throw new HttpError(res.status >= 500 ? 502 : res.status === 401 || res.status === 403 ? 502 : 400, friendly[code] ?? (detail || "Bachs rejected the request. Please try again."));
  }
  return body as T;
}

const last4 = (n?: string | null) => (n ? n.slice(-4) : "");

function toDestination(d: Record<string, unknown>): BankDestination {
  return {
    id: String(d.id),
    name: String(d.name ?? ""),
    currency: String(d.currency ?? "NGN"),
    bankName: String(d.bank_name ?? ""),
    bankCode: String(d.bank_code ?? ""),
    accountName: String(d.account_name ?? ""),
    accountLast4: last4(d.account_number as string | null),
    status: (d.status as BankDestination["status"]) ?? "pending_review",
    statusReason: (d.status_reason as string | null) ?? null,
    isUsable: !!d.is_usable,
    isDefault: !!d.is_default,
    createdAt: String(d.created_at ?? ""),
    reviewedAt: (d.reviewed_at as string | null) ?? null,
  };
}

/** Nigerian banks Bachs can pay out to (GET /v1/reference/banks?country=NG) */
export async function listBanks(): Promise<Bank[]> {
  const body = await bachs<{ banks?: { code: string; name: string }[] }>("/v1/reference/banks?country=NG");
  return (body.banks ?? []).map(b => ({ code: String(b.code), name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Looks up the account holder's name before saving (POST /v1/misc/bank-accounts/resolve) */
export async function resolveBankAccount(bankCode: string, accountNumber: string): Promise<ResolvedAccount> {
  const body = await bachs<{ resolved?: boolean; account_name?: string; message?: string | null }>("/v1/misc/bank-accounts/resolve", {
    method: "POST",
    body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber, country: "NG" }),
  });
  return { resolved: !!body.resolved, accountName: body.account_name, message: body.message ?? null };
}

/** Bank-account destinations on the hotel's Bachs account (GET /v1/payouts/destinations) */
export async function listDestinations(): Promise<BankDestination[]> {
  const body = await bachs<{ destinations?: Record<string, unknown>[] }>("/v1/payouts/destinations?limit=100");
  return (body.destinations ?? []).filter(d => d.type === "bank_account").map(toDestination);
}

/** Saves a new NGN bank account. Bachs resolves the holder name and reviews it before it can be used. */
export async function createDestination(input: { bankCode: string; accountNumber: string; name: string }): Promise<BankDestination> {
  const body = await bachs<Record<string, unknown>>("/v1/payouts/destinations", {
    method: "POST",
    body: JSON.stringify({ type: "bank_account", currency: "NGN", bank_code: input.bankCode, account_number: input.accountNumber, name: input.name }),
  });
  return toDestination(body);
}

/**
 * Renames an account or makes it the default for automatic payouts. Only `name` and `is_default` are sent,
 * which Bachs says never affects review status. To change the account number itself, add a new account instead.
 */
export async function updateDestination(id: string, patch: { name?: string; isDefault?: boolean }): Promise<BankDestination> {
  const body = await bachs<Record<string, unknown>>(`/v1/payouts/destinations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.isDefault !== undefined ? { is_default: patch.isDefault } : {}) }),
  });
  return toDestination(body);
}

export async function deleteDestination(id: string): Promise<void> {
  await bachs(`/v1/payouts/destinations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Available and settling balance per currency (GET /v1/balances) */
export async function getBalances(): Promise<BachsBalance[]> {
  const body = await bachs<{ balances?: { currency: string; available_balance: string; pending_balance: string }[] }>("/v1/balances");
  return (body.balances ?? []).map(b => ({ currency: b.currency, available: Number(b.available_balance), pending: Number(b.pending_balance) }));
}

/* ===================================================================== REFUNDS
 * Docs: Guides → Issue a refund, API reference → Refunds, Webhooks → refund.created / refund.paid / refund.failed.
 * A payment takes one refund; a failed refund doesn't count, so it can be tried again.
 * Bank transfers (NGN) can't be refunded by Bachs; card payments can. Your key needs the refunds:write scope.
 */

export interface BachsRefund {
  refundId: string;
  chargeId: string;
  reference: string;
  status: RefundStatus;
  requestedAmount?: number;
  refundedAmount?: number;
  completedAt?: string;
}

/** Bachs reports processing, then success (refund.paid) or failed */
export function toRefundStatus(status: unknown): RefundStatus {
  const s = String(status ?? "").toLowerCase();
  if (s === "success" || s === "succeeded" || s === "paid") return "refunded";
  if (s === "failed") return "failed";
  return "processing";
}

function toRefund(d: Record<string, unknown>): BachsRefund {
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  return {
    refundId: String(d.refund_id ?? d.id ?? ""),
    chargeId: String(d.charge_id ?? ""),
    reference: String(d.reference ?? ""),
    status: toRefundStatus(d.status),
    requestedAmount: num(d.requested_amount),
    refundedAmount: num(d.refunded_amount),
    completedAt: typeof d.completed_at === "string" ? d.completed_at : undefined,
  };
}

/** Raw call that keeps the status code, so refunds can tell "refused" from "outcome unknown" */
async function bachsRaw(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!SECRET_KEY) throw new HttpError(503, "Bachs is not set up yet. Add BACHS_SECRET_KEY on the server.");
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json", ...init.headers },
      cache: "no-store",
    });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch (err) {
    console.error("Bachs request failed", path, err);
    return { status: 0, body: {} }; // network error: treat like a 5xx
  }
}

const bachsMessage = (body: Record<string, unknown>) => String(body.detail ?? body.message ?? body.error ?? "");

/** The refund on a payment, if any (GET /v1/refunds/by-charge/{charge_id}). Prefers one that didn't fail. */
export async function getRefundForCharge(chargeId: string): Promise<BachsRefund | null> {
  const { status, body } = await bachsRaw(`/v1/refunds/by-charge/${encodeURIComponent(chargeId)}`);
  if (status === 404) return null;
  if (status < 200 || status >= 300) throw new HttpError(502, "Couldn't check the refund with Bachs. Please try again.");
  const items = Array.isArray(body.data) ? body.data : Array.isArray(body.refunds) ? body.refunds : [body];
  const refunds = (items as Record<string, unknown>[]).filter(r => r && (r.refund_id || r.id)).map(toRefund);
  return refunds.find(r => r.status !== "failed") ?? refunds[0] ?? null;
}

/** One refund by id (GET /v1/refunds/{refund_id}) */
export async function getRefund(refundId: string): Promise<BachsRefund> {
  const { status, body } = await bachsRaw(`/v1/refunds/${encodeURIComponent(refundId)}`);
  if (status < 200 || status >= 300) throw new HttpError(status === 404 ? 404 : 502, status === 404 ? "Bachs has no record of that refund." : "Couldn't check the refund with Bachs. Please try again.");
  return toRefund(body);
}

/**
 * Refunds a payment in full (POST /v1/refunds without `amount`). `reference` doubles as the idempotency key,
 * so sending the same reference again returns the refund already created instead of a second one.
 * If Bachs doesn't answer (5xx or network), the refund may still exist: we look it up by charge before giving up.
 * Returns null only when the outcome is still unknown.
 */
export async function createRefund(input: { chargeId: string; reference: string; reason?: string }): Promise<BachsRefund | null> {
  const { status, body } = await bachsRaw("/v1/refunds", {
    method: "POST",
    body: JSON.stringify({
      charge_id: input.chargeId,
      reference: input.reference.slice(0, 128),
      idempotency_key: input.reference.slice(0, 255),
      ...(input.reason ? { reason: input.reason.slice(0, 200) } : {}),
    }),
  });
  if (status >= 200 && status < 300) return toRefund(body);

  const message = bachsMessage(body);
  if (status === 409 || status === 0 || status >= 500) {
    // 409: a refund already exists for this charge (or our reference was used). 5xx: we don't know if it was created.
    const existing = await getRefundForCharge(input.chargeId).catch(() => undefined);
    if (existing && existing.status !== "failed") return existing;
    if (status === 409) throw new HttpError(409, message || "Bachs already has a refund for this payment.");
    if (existing === undefined) return null; // couldn't check either: leave it pending, the webhook will tell us
    throw new HttpError(502, "Bachs didn't respond, and no refund was created. Please try again.");
  }

  console.error("Bachs refund refused", status, body);
  const m = message.toLowerCase();
  const friendly = m.includes("not supported for this charge")
    ? "Bachs can't refund this payment method (bank transfers can't be refunded). Send the money back with a payout from the Bachs dashboard."
    : m.includes("insufficient balance")
      ? "The Bachs balance is too low to fund this refund. Top it up, then try again."
      : m.includes("not refundable")
        ? "Bachs says this payment can't be refunded (it may already be refunded). Check it in the Bachs dashboard."
        : message || "Bachs refused the refund. Please try again.";
  throw new HttpError(status === 401 || status === 403 ? 502 : 400, friendly);
}

/** The parts of a `refund.*` event Keepr uses */
export interface RefundEvent {
  eventId: string;
  type: "refund.created" | "refund.paid" | "refund.failed";
  refund: BachsRefund;
  reason?: string;
}

export function parseRefundEvent(event: Record<string, unknown>): RefundEvent | null {
  if (event.type !== "refund.created" && event.type !== "refund.paid" && event.type !== "refund.failed") return null;
  const d = (event.data ?? {}) as Record<string, unknown>;
  const refund = toRefund(d);
  // The event type is the final word even if `status` is spelled differently
  refund.status = event.type === "refund.paid" ? "refunded" : event.type === "refund.failed" ? "failed" : "processing";
  return { eventId: String(event.id), type: event.type, refund, reason: typeof d.reason === "string" ? d.reason : undefined };
}

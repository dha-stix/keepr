import { createDestination, getBalances, listDestinations, resolveBankAccount } from "@/lib/bachs";
import { connection } from "next/server";
import { errorResponse, HttpError, requireRecentSignIn, requireUser } from "@/lib/firebase-admin";
import { logPayoutChange } from "@/lib/payout-log";

/** Admin managers: the hotel's payout bank accounts and Bachs balance */
export async function GET(req: Request) {
  await connection(); // per-request: reads the caller's sign-in token
  try {
    await requireUser(req, ["admin"]);
    const [destinations, balances] = await Promise.all([listDestinations(), getBalances().catch(() => [])]);
    return Response.json({ destinations, balances });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Admin managers add a Nigerian bank account. Requires a password check in the last 10 minutes. */
export async function POST(req: Request) {
  try {
    const admin = await requireUser(req, ["admin"]);
    await requireRecentSignIn(admin);
    const { bankCode, accountNumber, name } = (await req.json()) as { bankCode?: string; accountNumber?: string; name?: string };
    if (!bankCode) throw new HttpError(400, "Choose a bank.");
    if (!/^\d{10}$/.test(accountNumber ?? "")) throw new HttpError(400, "Enter the 10-digit account number.");
    // Check the account exists before saving, so a typo fails now rather than in Bachs review days later
    const check = await resolveBankAccount(bankCode, accountNumber!);
    if (!check.resolved) throw new HttpError(400, check.message || "That account number doesn't match the bank. Check both and try again.");
    const destination = await createDestination({ bankCode, accountNumber: accountNumber!, name: (name || "").trim().slice(0, 80) || "Keepr payouts" });
    await logPayoutChange(admin, `${admin.name} added payout account ${destination.bankName} ••${destination.accountLast4} (${destination.accountName}); waiting for Bachs review`);
    return Response.json({ destination }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

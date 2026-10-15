import { resolveBankAccount } from "@/lib/bachs";
import { errorResponse, HttpError, requireUser } from "@/lib/firebase-admin";

/** Looks up the account holder's name so the manager can confirm it before saving */
export async function POST(req: Request) {
  try {
    await requireUser(req, ["admin"]);
    const { bankCode, accountNumber } = (await req.json()) as { bankCode?: string; accountNumber?: string };
    if (!bankCode || !/^\d{10}$/.test(accountNumber ?? "")) throw new HttpError(400, "Choose a bank and enter the 10-digit account number.");
    return Response.json(await resolveBankAccount(bankCode, accountNumber!));
  } catch (err) {
    return errorResponse(err);
  }
}

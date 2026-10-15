import { deleteDestination, listDestinations, updateDestination } from "@/lib/bachs";
import { errorResponse, HttpError, requireRecentSignIn, requireUser } from "@/lib/firebase-admin";
import { logPayoutChange } from "@/lib/payout-log";

async function findDestination(id: string) {
  const d = (await listDestinations()).find(x => x.id === id);
  if (!d) throw new HttpError(404, "That bank account no longer exists on Bachs.");
  return d;
}

/**
 * Rename an account, or make it the default for automatic payouts.
 * Only name and default are changed here; Bachs keeps the account's approval for those.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/bachs/destinations/[id]">) {
  try {
    const admin = await requireUser(req, ["admin"]);
    const { id } = await ctx.params;
    const { name, isDefault } = (await req.json()) as { name?: string; isDefault?: boolean };
    const before = await findDestination(id);
    if (isDefault) {
      await requireRecentSignIn(admin); // changes where automatic payouts go
      if (!before.isUsable) throw new HttpError(400, "Only accounts Bachs has approved can be the default.");
    }
    const patch = { ...(name !== undefined ? { name: name.trim().slice(0, 80) } : {}), ...(isDefault !== undefined ? { isDefault } : {}) };
    if (!Object.keys(patch).length) throw new HttpError(400, "Nothing to change.");
    const destination = await updateDestination(id, patch);
    await logPayoutChange(
      admin,
      isDefault ? `${admin.name} made ${destination.bankName} ••${destination.accountLast4} the default payout account` : `${admin.name} renamed payout account ••${destination.accountLast4} to “${destination.name}”`,
    );
    return Response.json({ destination });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Remove a payout account. Requires a password check in the last 10 minutes. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/bachs/destinations/[id]">) {
  try {
    const admin = await requireUser(req, ["admin"]);
    await requireRecentSignIn(admin);
    const { id } = await ctx.params;
    const d = await findDestination(id);
    await deleteDestination(id);
    await logPayoutChange(admin, `${admin.name} removed payout account ${d.bankName} ••${d.accountLast4}`);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

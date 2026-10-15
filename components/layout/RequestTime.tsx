import { connection } from "next/server";

/**
 * Marks a route as rendered per request. Used on private pages with addresses only known at request time
 * (e.g. /checkout/[bookingId]) so their share metadata can be built then. Render inside <Suspense>.
 */
export async function RequestTime() {
  await connection();
  return null;
}

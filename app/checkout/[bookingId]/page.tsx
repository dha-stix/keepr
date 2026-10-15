import type { Metadata } from "next";
import { Suspense } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { RequestTime } from "@/components/layout/RequestTime";

// Signed-in area: content waits for Firebase auth in the browser (RoleGuard), so navigation here may block on it
export const instant = false;

// Private page: keep it out of search results and link previews of other people's bookings
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function CheckoutPage({ params }: PageProps<"/checkout/[bookingId]">) {
  return (
    <>
      <Suspense>
        <RequestTime />
      </Suspense>
      <RoleGuard allow={["customer"]}>
        <Suspense fallback={<div className="container-x skeleton mt-8 h-[480px]" />}>
          <CheckoutView params={params} />
        </Suspense>
      </RoleGuard>
    </>
  );
}

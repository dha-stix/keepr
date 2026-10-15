import type { Metadata } from "next";
import { GuestPayments } from "@/components/dashboard/GuestViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return <GuestPayments />;
}

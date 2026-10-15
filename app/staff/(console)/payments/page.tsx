import type { Metadata } from "next";
import { StaffPayments } from "@/components/staff/StaffViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return <StaffPayments />;
}

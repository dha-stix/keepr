import type { Metadata } from "next";
import { AdminPayments } from "@/components/admin/AdminViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "All payments" };

export default function Page() {
  return <AdminPayments />;
}

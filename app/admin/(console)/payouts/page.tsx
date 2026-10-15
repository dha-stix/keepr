import type { Metadata } from "next";
import { PayoutAccounts } from "@/components/admin/PayoutAccounts";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Bank details" };

export default function Page() {
  return <PayoutAccounts />;
}

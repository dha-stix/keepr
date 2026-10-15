import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/AdminViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Admin overview" };

export default function Page() {
  return <AdminOverview />;
}

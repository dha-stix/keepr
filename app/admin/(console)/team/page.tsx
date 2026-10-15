import type { Metadata } from "next";
import { AdminTeam } from "@/components/admin/AdminViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Team" };

export default function Page() {
  return <AdminTeam />;
}

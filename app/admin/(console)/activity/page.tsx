import type { Metadata } from "next";
import { AdminActivity } from "@/components/admin/AdminViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Activity log" };

export default function Page() {
  return <AdminActivity />;
}

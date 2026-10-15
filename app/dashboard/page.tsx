import type { Metadata } from "next";
import { GuestOverview } from "@/components/dashboard/GuestViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "My dashboard" };

export default function Page() {
  return <GuestOverview />;
}

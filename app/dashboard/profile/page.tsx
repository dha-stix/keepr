import type { Metadata } from "next";
import { GuestProfile } from "@/components/dashboard/GuestViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <GuestProfile />;
}

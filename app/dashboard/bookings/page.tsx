import type { Metadata } from "next";
import { GuestBookings } from "@/components/dashboard/GuestViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "My bookings" };

export default function Page() {
  return <GuestBookings />;
}

import type { Metadata } from "next";
import { StaffBookings } from "@/components/staff/StaffViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Bookings" };

export default function Page() {
  return <StaffBookings />;
}

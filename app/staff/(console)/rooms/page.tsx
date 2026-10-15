import type { Metadata } from "next";
import { StaffRooms } from "@/components/staff/StaffViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Room board" };

export default function Page() {
  return <StaffRooms />;
}

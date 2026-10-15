import type { Metadata } from "next";
import { AdminRooms } from "@/components/admin/AdminViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Rooms and prices" };

export default function Page() {
  return <AdminRooms />;
}

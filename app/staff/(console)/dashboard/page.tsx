import type { Metadata } from "next";
import { FrontDesk } from "@/components/staff/StaffViews";

// Renders after Firebase auth resolves in the browser (see RoleGuard)
export const instant = false;

export const metadata: Metadata = { title: "Front desk" };

export default function Page() {
  return <FrontDesk />;
}

import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";

// Signed-in area: content waits for Firebase auth in the browser (RoleGuard), so navigation here may block on it
export const instant = false;

// Staff console. Admin managers can use it too.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow={["staff", "admin"]}>
      <DashboardShell nav="staff">{children}</DashboardShell>
    </RoleGuard>
  );
}

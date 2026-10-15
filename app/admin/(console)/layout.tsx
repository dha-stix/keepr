import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardShell } from "@/components/layout/DashboardShell";

// Signed-in area: content waits for Firebase auth in the browser (RoleGuard), so navigation here may block on it
export const instant = false;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allow={["admin"]}>
      <DashboardShell nav="admin">{children}</DashboardShell>
    </RoleGuard>
  );
}

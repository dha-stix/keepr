"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ROLE_HOME, ROLE_LOGIN } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { useAuth } from "./AuthProvider";

/**
 * Keeps a section of the app to the roles that may see it. Signed-out visitors go to the right login page,
 * and signed-in users with the wrong role go to their own dashboard.
 * The real enforcement is in firestore.rules; this is for navigation.
 */
export function RoleGuard({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const ok = !!user && allow.includes(user.role);

  useEffect(() => {
    if (loading || ok) return;
    // Read the URL here rather than with usePathname so guarded dynamic routes can still prerender a shell
    const here = window.location.pathname + window.location.search;
    if (!user) router.replace(`${ROLE_LOGIN[allow[0]!]}?next=${encodeURIComponent(here)}`);
    else router.replace(ROLE_HOME[user.role]);
  }, [loading, ok, user, allow, router]);

  if (!ok) return <GuardSkeleton />;
  return <>{children}</>;
}

function GuardSkeleton() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-pine" />
        Checking your access…
      </div>
    </div>
  );
}

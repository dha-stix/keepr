import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsoleLogin } from "@/components/auth/ConsoleLogin";

export const metadata: Metadata = { title: "Staff login" };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-pine-deep" />}>
      <ConsoleLogin role="staff" />
    </Suspense>
  );
}

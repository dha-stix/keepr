import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleAuthCard } from "@/components/auth/GoogleAuthCard";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <GoogleAuthCard mode="register" />
    </Suspense>
  );
}

"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import type { CategorySettingsMap } from "@/lib/categories";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CategoriesProvider } from "@/components/rooms/CategoriesProvider";
import { ToastProvider } from "@/components/ui/Toaster";
import { missingFirebaseKeys } from "@/lib/firebase";
import { SetupNotice } from "./SetupNotice";

export function Providers({ children, categories }: { children: ReactNode; categories: { map: CategorySettingsMap; loaded: boolean } }) {
  if (missingFirebaseKeys.length) return <SetupNotice missing={missingFirebaseKeys} />;
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <CategoriesProvider initial={categories}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </CategoriesProvider>
      </AuthProvider>
    </MotionConfig>
  );
}

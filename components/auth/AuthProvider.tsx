"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthChange, signOutUser } from "@/lib/firebase-actions";
import type { AppUser } from "@/lib/types";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthChange(u => {
        setUser(u);
        setLoading(false);
      }),
    [],
  );

  return <AuthContext.Provider value={{ user, loading, signOut: signOutUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

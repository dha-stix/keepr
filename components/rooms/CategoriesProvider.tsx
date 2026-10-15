"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CATEGORIES, liveCategories, type LiveCategories } from "@/lib/categories";
import { subscribeToCategories } from "@/lib/firebase-actions";
import { useLive } from "@/lib/hooks";
import type { CategorySettingsMap } from "@/lib/categories";

interface CategoriesState {
  categories: LiveCategories;
  /** False until the managers' prices have loaded; show a placeholder for prices until then */
  ready: boolean;
}

const CategoriesContext = createContext<CategoriesState>({ categories: DEFAULT_CATEGORIES, ready: false });

/**
 * One app-wide subscription to the room types' current prices and photos.
 * `initial` comes from the server (lib/categories-server.ts), so the first paint already shows the managers' photos.
 */
export function CategoriesProvider({ children, initial }: { children: ReactNode; initial: { map: CategorySettingsMap; loaded: boolean } }) {
  const { data, loading } = useLive<CategorySettingsMap>(subscribeToCategories, []);
  const map = data ?? (initial.loaded ? initial.map : undefined);
  return <CategoriesContext.Provider value={{ categories: map ? liveCategories(map) : DEFAULT_CATEGORIES, ready: !loading || initial.loaded }}>{children}</CategoriesContext.Provider>;
}

export const useCategories = () => useContext(CategoriesContext);

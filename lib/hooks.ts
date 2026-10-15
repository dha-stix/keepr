"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Unsubscribe } from "./types";
import { firebaseNow, isFirebaseClockSynced, subscribeToFirebaseClock } from "./firebase-clock";
import { todayISO } from "./utils";

/**
 * Subscribes to a live data source from firebase-actions (Firestore onSnapshot) for as long
 * as the component is mounted. Pass null as the subscribe function to wait (e.g. until the user loads).
 * `loading` is true until the first value for the current deps arrives.
 */
export function useLive<T>(subscribe: ((cb: (v: T) => void) => Unsubscribe) | null, deps: unknown[]): { data: T | undefined; loading: boolean } {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string; data?: T }>({ key: "\u0000" });
  useEffect(() => {
    if (!subscribe) return;
    return subscribe(data => setState({ key, data }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !subscribe]);
  const fresh = state.key === key;
  return { data: fresh ? state.data : undefined, loading: !fresh };
}

/** Runs a one-off async load whenever `key` changes. `data` is undefined while loading. */
export function useAsync<T>(load: (() => Promise<T>) | null, key: string): { data: T | undefined; error: boolean } {
  const [state, setState] = useState<{ key: string; data?: T; error?: boolean }>({ key: "\u0000" });
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then(
      data => live && setState({ key, data }),
      () => live && setState({ key, error: true }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const fresh = state.key === key;
  return { data: fresh ? state.data : undefined, error: fresh && !!state.error };
}

/**
 * A value worked out from Firebase's current time (see lib/firebase-clock.ts). Renders `fallback` on the server,
 * during hydration and until the clock is synced, so nothing is ever shown from the device's own clock.
 */
export function useFirebaseTimeValue<T>(get: (nowMs: number) => T, fallback: T): T {
  return useSyncExternalStore(
    subscribeToFirebaseClock,
    () => (isFirebaseClockSynced() ? get(firebaseNow()) : fallback),
    () => fallback,
  );
}

/** Today at the hotel (YYYY-MM-DD, Lagos time) by Firebase's clock; "" until that's known */
export const useToday = () => useFirebaseTimeValue(todayISO, "");

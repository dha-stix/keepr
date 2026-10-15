"use client";

import { subscribeToActivity, subscribeToAllBookings, subscribeToPayments, subscribeToRooms } from "@/lib/firebase-actions";
import { useLive } from "@/lib/hooks";
import type { ActivityEntry, Booking, Payment, Room } from "@/lib/types";

/** Live hotel-wide data for staff and admin views. Each piece subscribes only when asked for. */
export function useRooms() {
  return useLive<Room[]>(subscribeToRooms, []);
}
export function useAllBookings() {
  return useLive<Booking[]>(subscribeToAllBookings, []);
}
/** All-time payments for admin managers; pass `sinceDays` for staff (see STAFF_PAYMENT_DAYS) */
export function usePayments(sinceDays?: number) {
  return useLive<Payment[]>(cb => subscribeToPayments(cb, sinceDays), [sinceDays]);
}
export function useActivity(max = 40) {
  return useLive<ActivityEntry[]>(cb => subscribeToActivity(cb, max), [max]);
}

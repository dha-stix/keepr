"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toaster";
import { displayRoomStatus } from "@/lib/booking-rules";
import { CATEGORY_LIST, ROOM_STATUS } from "@/lib/constants";
import { setRoomStatus } from "@/lib/firebase-actions";
import type { Booking, Room, RoomStatus } from "@/lib/types";
import { cx } from "@/lib/utils";

/**
 * Every room as a colour-coded tile, grouped by category. With `editable`, staff can tap a free or
 * cleaning room to change it (occupied is set by check-in/out, reserved comes from today's arrivals).
 */
export function RoomBoard({ rooms, bookings, today, editable, compact }: { rooms: Room[]; bookings: Booking[]; today: string; editable?: boolean; compact?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState<RoomStatus | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const tiles = useMemo(
    () =>
      rooms.map(r => {
        const status = displayRoomStatus(r, bookings, today);
        const guest = bookings.find(b => b.roomId === r.id && (b.status === "checked_in" || (b.checkIn === today && (b.status === "paid" || b.status === "confirmed"))));
        return { room: r, status, guest };
      }),
    [rooms, bookings, today],
  );
  const counts = tiles.reduce<Record<string, number>>((m, t) => ({ ...m, [t.status]: (m[t.status] ?? 0) + 1 }), {});

  const change = async (room: Room, status: RoomStatus) => {
    if (!user) return;
    setOpen(null);
    try {
      await setRoomStatus(room, status, { uid: user.uid, name: user.name });
      toast(`Room ${room.number} set to ${ROOM_STATUS[status].label.toLowerCase()}`);
    } catch {
      toast("Couldn't update that room. Try again.", "error");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter rooms by status">
        {(["all", "available", "reserved", "occupied", "cleaning"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors", filter === s ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink/40")}
          >
            {s !== "all" && <span className="h-2 w-2 rounded-full" style={{ background: ROOM_STATUS[s].color }} />}
            {s === "all" ? "All" : ROOM_STATUS[s].label}
            <span className="num opacity-70">{s === "all" ? rooms.length : (counts[s] ?? 0)}</span>
          </button>
        ))}
      </div>

      {CATEGORY_LIST.map(c => {
        const group = tiles.filter(t => t.room.category === c.key && (filter === "all" || t.status === filter));
        if (!group.length) return null;
        return (
          <section key={c.key} className="grid gap-2">
            {!compact && (
              <h4 className="text-xs font-semibold tracking-[.1em] text-muted uppercase">
                {c.name} · <span className="num">{c.range[0]}–{c.range[1]}</span>
              </h4>
            )}
            <motion.div layout className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {group.map(({ room, status, guest }) => {
                const changeable = editable && (status === "available" || status === "cleaning");
                return (
                  <motion.div layout key={room.id} className="relative">
                    <button
                      onClick={() => changeable && setOpen(open === room.id ? null : room.id)}
                      className={cx(
                        "relative grid w-full gap-0.5 overflow-hidden rounded-[10px] border border-line bg-surface p-2.5 text-left text-[11px] transition-transform",
                        changeable ? "cursor-pointer hover:scale-[1.04]" : "cursor-default",
                      )}
                      title={guest ? `${guest.guestName} · ${guest.code}` : ROOM_STATUS[status].label}
                      aria-label={`Room ${room.number}, ${ROOM_STATUS[status].label}${guest ? `, ${guest.guestName}` : ""}`}
                    >
                      <motion.span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r" animate={{ backgroundColor: ROOM_STATUS[status].color }} transition={{ duration: 0.5 }} />
                      <b className="num text-sm font-medium">{room.number}</b>
                      <span className="truncate text-muted">{guest ? guest.guestName.split(" ")[0] : c.name}</span>
                      <span style={{ color: ROOM_STATUS[status].color }}>{ROOM_STATUS[status].label}</span>
                    </button>
                    <AnimatePresence>
                      {open === room.id && (
                        <motion.div
                          className="absolute top-full left-0 z-20 mt-1 grid min-w-[150px] gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-xl"
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        >
                          {(["available", "cleaning"] as const)
                            .filter(s => s !== room.status)
                            .map(s => (
                              <button key={s} onClick={() => change(room, s)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-paper">
                                <span className="h-2 w-2 rounded-full" style={{ background: ROOM_STATUS[s].color }} />
                                {s === "available" ? "Mark clean and available" : "Send to cleaning"}
                              </button>
                            ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          </section>
        );
      })}
    </div>
  );
}

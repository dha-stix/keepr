import type { Metadata } from "next";
import { shareMeta } from "@/lib/site";
import { Suspense } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { RoomsBrowser } from "@/components/rooms/RoomsBrowser";

const description = "Standard, Exclusive and Presidential rooms in Lekki. Check availability for your dates and book online in a minute.";

export const metadata: Metadata = {
  title: "Rooms",
  description,
  ...shareMeta({ title: "Rooms at Keepr", description, url: "/rooms" }),
};

export default function RoomsPage() {
  return (
    <PublicShell>
      {/* The search lives in the URL, which is only known at request time */}
      <Suspense fallback={<div className="container-x skeleton mt-6 h-[480px]" />}>
        <RoomsBrowser />
      </Suspense>
    </PublicShell>
  );
}

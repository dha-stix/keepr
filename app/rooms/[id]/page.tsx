import type { Metadata } from "next";
import { shareMeta } from "@/lib/site";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { BookingCard } from "@/components/rooms/BookingCard";
import { RoomGallery } from "@/components/rooms/RoomGallery";
import { CATEGORIES } from "@/lib/constants";
import { buildInventory } from "@/lib/utils";

// The 66 rooms are fixed, so every room page is prerendered at build time
export function generateStaticParams() {
  return buildInventory().map(r => ({ id: r.id }));
}

const findRoom = (id: string) => buildInventory().find(r => r.id === id);

export async function generateMetadata({ params }: PageProps<"/rooms/[id]">): Promise<Metadata> {
  const room = findRoom((await params).id);
  if (!room) return { title: "Room not found" };
  const c = CATEGORIES[room.category];
  const title = `${c.name} room ${room.number}`;
  const description = `${c.blurb} ${room.wing}. Book online at Keepr, Lekki.`;
  return {
    title,
    description,
    ...shareMeta({ title: `${title} · Keepr`, description, url: `/rooms/${room.id}` }),
  };
}

/**
 * The page shell renders instantly; the room-specific part reads `params` inside <Suspense>, as Cache Components
 * with Partial Prefetching expects (see the "ISR with Cache Components" guide in the Next.js docs).
 */
export default function RoomPage({ params }: PageProps<"/rooms/[id]">) {
  return (
    <PublicShell>
      <div className="container-x pt-4 pb-16">
        <Suspense fallback={<RoomSkeleton />}>
          <RoomDetail params={params} />
        </Suspense>
      </div>
    </PublicShell>
  );
}

async function RoomDetail({ params }: Pick<PageProps<"/rooms/[id]">, "params">) {
  const room = findRoom((await params).id);
  if (!room) notFound();
  const c = CATEGORIES[room.category];
  const title = `${c.name} · Room ${room.number}`;

  return (
    <>
      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/rooms" className="hover:text-ink">
          Rooms
        </Link>{" "}
        /{" "}
        <Link href={`/rooms?category=${c.key}`} className="hover:text-ink">
          {c.name}
        </Link>{" "}
        / <span className="num">{room.number}</span>
      </nav>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-6">
          <RoomGallery room={room} title={title} />
          <div>
            <div className="num text-[11px] tracking-[.1em] text-brass uppercase">
              {c.name} · {room.wing}
            </div>
            <h1 className="display mt-2 text-[36px] md:text-[46px]">
              {c.name} {c.bed.includes("bedroom") ? "Suite" : c.bed.split(" ")[0]} · Room <span className="num text-[0.7em]">{room.number}</span>
            </h1>
            <p className="mt-3 max-w-[62ch] text-muted">{c.blurb}</p>
          </div>
          <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {c.amenities.map(a => (
              <li key={a} className="before:mr-2 before:text-brass before:content-['—']">
                {a}
              </li>
            ))}
          </ul>
        </div>
        <Suspense fallback={<div className="skeleton h-[440px]" />}>
          <BookingCard room={room} />
        </Suspense>
      </div>
    </>
  );
}

function RoomSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <div className="skeleton h-5 w-48" />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          <div className="skeleton h-[250px] md:h-[450px]" />
          <div className="skeleton h-12 w-3/4" />
        </div>
        <div className="skeleton h-[440px]" />
      </div>
    </div>
  );
}

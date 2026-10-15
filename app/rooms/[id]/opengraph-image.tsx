import { liveCategory } from "@/lib/categories";
import { getInitialCategories } from "@/lib/categories-server";
import { CATEGORIES } from "@/lib/constants";
import { nairaText, Pill, priceOf, roomTypePhoto, shareContentType, shareImage, shareSize } from "@/lib/share-image";
import { buildInventory } from "@/lib/utils";

export const alt = "A room at Keepr, with its price per night";
export const size = shareSize;
export const contentType = shareContentType;

/** Preview image for a room page: that room's photo, number, price and features */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = buildInventory().find(r => r.id === id) ?? buildInventory()[0]!;
  const c = CATEGORIES[room.category];
  const { map } = await getInitialCategories();
  // Same photo the room's card leads with (rooms rotate through their type's photos by number)
  const count = liveCategory(room.category, map[room.category]).photoIds.length;
  const photo = await roomTypePhoto(room.category, map, (room.number / 2) % count);
  return shareImage({
    eyebrow: `${c.name} · ${room.wing}`,
    title: [{ text: "Room" }, { text: String(room.number), mono: true }],
    subtitle: c.blurb,
    footer: (
      <>
        <Pill strong>{`${nairaText(priceOf(room.category, map))} / night`}</Pill>
        <Pill>{c.size}</Pill>
        <Pill>{`Sleeps ${c.maxGuests}`}</Pill>
      </>
    ),
    photos: [{ src: photo }],
  });
}

import { getInitialCategories } from "@/lib/categories-server";
import { CATEGORY_LIST, TOTAL_ROOMS } from "@/lib/constants";
import { nairaText, Pill, priceOf, roomTypePhoto, shareContentType, shareImage, shareSize } from "@/lib/share-image";

export const alt = "Keepr rooms: Standard, Exclusive and Presidential, with prices per night";
export const size = shareSize;
export const contentType = shareContentType;

/** Preview image for /rooms: the three room types' cover photos with their prices */
export default async function Image() {
  const { map } = await getInitialCategories();
  const from = Math.min(...CATEGORY_LIST.map(c => priceOf(c.key, map)));
  return shareImage({
    eyebrow: `${TOTAL_ROOMS} rooms in Lekki`,
    title: [{ text: "Three ways to" }, { text: "stay", italic: true }],
    subtitle: "Check availability for your dates and book in a minute.",
    footer: <Pill strong>{`from ${nairaText(from)} / night`}</Pill>,
    photos: await Promise.all(CATEGORY_LIST.map(async c => ({ src: await roomTypePhoto(c.key, map), label: `${c.name} · ${nairaText(priceOf(c.key, map))}` }))),
  });
}

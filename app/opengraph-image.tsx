import { getInitialCategories } from "@/lib/categories-server";
import { CATEGORY_LIST, TOTAL_ROOMS } from "@/lib/constants";
import { imageFileSrc, nairaText, Pill, priceOf, shareContentType, shareImage, shareSize } from "@/lib/share-image";

export const alt = "Keepr hotel in Lekki: book a room online and walk straight to your key";
export const size = shareSize;
export const contentType = shareContentType;

/** Preview image for the home page (and any page without its own) */
export default async function Image() {
  const { map } = await getInitialCategories();
  return shareImage({
    eyebrow: `Lekki · ${TOTAL_ROOMS} rooms · Front desk 24/7`,
    title: [{ text: "Your room is" }, { text: "ready", italic: true }, { text: "before you arrive." }],
    subtitle: "Pick a room, pay online and walk straight to your key.",
    footer: CATEGORY_LIST.map(c => <Pill key={c.key}>{`${c.name} ${nairaText(priceOf(c.key, map))}`}</Pill>),
    photos: [{ src: await imageFileSrc("heroNight") }],
  });
}

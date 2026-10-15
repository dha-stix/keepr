// Branded 1200×630 link preview images, shared by the opengraph-image routes.
// They use the managers' current photos and prices (lib/categories-server.ts), so a shared link always
// shows what the website shows.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { BUILTIN_PREFIX, liveCategory, type CategorySettingsMap } from "./categories";
import { CATEGORIES } from "./constants";
import { imageFiles, type ImageKey } from "@/images";
import type { CategoryKey } from "./types";

export const shareSize = { width: 1200, height: 630 };
export const shareContentType = "image/png";

const C = { pine: "#1e4a3f", deep: "#10231e", brass: "#a87530", brassLight: "#e9c88c", paper: "#f2f3ef", muted: "#b9c4be" };

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
const fontsPromise = Promise.all([
  font("BodoniModa-Medium.ttf").then(data => ({ name: "Bodoni", data, weight: 500 as const, style: "normal" as const })),
  font("BodoniModa-MediumItalic.ttf").then(data => ({ name: "Bodoni", data, weight: 500 as const, style: "italic" as const })),
  font("Outfit-Regular.ttf").then(data => ({ name: "Outfit", data, weight: 400 as const, style: "normal" as const })),
  font("Outfit-SemiBold.ttf").then(data => ({ name: "Outfit", data, weight: 600 as const, style: "normal" as const })),
  font("IBMPlexMono-Medium.ttf").then(data => ({ name: "Plex", data, weight: 500 as const, style: "normal" as const })),
  // Has the ₦ sign, for any text whose main font lacks it
  font("NotoSans-SemiBold.ttf").then(data => ({ name: "Noto", data, weight: 600 as const, style: "normal" as const })),
]);

/** A photo from /images as a data URL */
export async function imageFileSrc(key: ImageKey) {
  const data = await readFile(join(process.cwd(), "images", imageFiles[key]), "base64");
  return `data:image/jpeg;base64,${data}`;
}

/** A room type photo by position (0 = cover), following the manager's list. Uploaded photos are fetched by URL. */
export async function roomTypePhoto(key: CategoryKey, map: CategorySettingsMap, position = 0) {
  const ids = liveCategory(key, map[key]).photoIds;
  const id = ids[position % ids.length]!;
  if (id.startsWith(BUILTIN_PREFIX)) return imageFileSrc(CATEGORIES[key].photoKeys[Number(id.slice(BUILTIN_PREFIX.length))]!);
  if (id.startsWith("https://")) return id;
  return imageFileSrc(CATEGORIES[key].photoKeys[0]!); // anything else: fall back to the built-in cover
}

export const priceOf = (key: CategoryKey, map: CategorySettingsMap) => liveCategory(key, map[key]).price;
export const nairaText = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ display: "flex", width: 30, height: 42, borderRadius: 7, background: C.brass, padding: "9px 8px" }}>
        <div style={{ width: 14, height: 4, borderRadius: 2, background: C.paper }} />
      </div>
      <div style={{ fontFamily: "Bodoni", fontSize: 40, color: C.paper, letterSpacing: -0.5 }}>Keepr</div>
    </div>
  );
}

/** The shared layout: brand and text on the left, photo(s) on the right */
/** Headline pieces; italic pieces are set in brass italic like the site's hero */
export type TitlePart = { text: string; italic?: boolean; mono?: boolean };

export async function shareImage({ eyebrow, title, subtitle, footer, photos }: { eyebrow: string; title: TitlePart[]; subtitle?: string; footer?: ReactNode; photos: { src: string; label?: string }[] }) {
  const fonts = await fontsPromise;
  const single = photos.length === 1;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: C.deep, fontFamily: "Outfit, Noto", color: C.paper }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: single ? 600 : 560, padding: "52px 48px 48px 60px" }}>
          <Logo />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontFamily: "Outfit", fontWeight: 600, fontSize: 19, letterSpacing: 3.5, color: C.brassLight, textTransform: "uppercase" }}>{eyebrow}</div>
            {/* One span per word, so the headline wraps between words inside the text column */}
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 16, fontFamily: "Bodoni", fontSize: 60, lineHeight: 1.08, letterSpacing: -1 }}>
              {title.flatMap((part, i) =>
                part.text.split(/\s+/).filter(Boolean).map((w, j) => (
                  <span key={`${i}-${j}`} style={part.italic ? { fontStyle: "italic", color: C.brassLight } : part.mono ? { fontFamily: "Plex", fontSize: 54 } : {}}>
                    {w}
                  </span>
                )),
              )}
            </div>
            {subtitle && <div style={{ fontSize: 25, lineHeight: 1.4, color: C.muted }}>{subtitle}</div>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>{footer}</div>
        </div>
        <div style={{ display: "flex", flex: 1, gap: 12, padding: "28px 28px 28px 0", flexDirection: single ? "row" : "column" }}>
          {photos.map((p, i) => (
            <div key={i} style={{ display: "flex", position: "relative", flex: 1, borderRadius: single ? 28 : 20, overflow: "hidden", border: `2px solid ${C.pine}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>, not next/image */}
              <img src={p.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {p.label && (
                <div style={{ display: "flex", position: "absolute", left: 16, bottom: 14, padding: "6px 14px", borderRadius: 10, background: "rgba(16,35,30,0.82)", fontSize: 22, fontWeight: 600 }}>{p.label}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...shareSize, fonts },
  );
}

/** A brass-outlined pill for the footer row */
export function Pill({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <div style={{ display: "flex", padding: "9px 18px", borderRadius: 999, fontSize: 22, fontFamily: strong ? "Plex, Noto" : "Outfit, Noto", fontWeight: strong ? 500 : 400, background: strong ? C.brass : "transparent", color: strong ? "#1a1209" : C.paper, border: `1.5px solid ${strong ? C.brass : "rgba(242,243,239,0.35)"}` }}>
      {children}
    </div>
  );
}


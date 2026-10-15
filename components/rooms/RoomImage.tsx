import Image, { type ImageProps } from "next/image";
import type { Photo } from "@/lib/types";
import { cx } from "@/lib/utils";

/**
 * next/image for every hotel photo, built in (/images) or uploaded by a manager.
 * No blurred placeholder: the real photo renders straight away over the page's sunk colour.
 */
export function RoomImage({ src, alt, className, ...rest }: Omit<ImageProps, "src" | "placeholder"> & { src: Photo }) {
  const uploaded = typeof src === "string";
  return <Image src={src} alt={alt} unoptimized={uploaded && src.startsWith("data:")} className={cx("bg-sunk", className)} {...rest} />;
}

// Room types as the site shows them: the built-in definition from constants, with the manager's price and photos on top.
import { CATEGORIES, CATEGORY_LIST, type Category } from "./constants";
import type { CategoryKey, CategorySettings, Photo } from "./types";

/**
 * Each room type has an ordered list of 1–10 photos. The first is the cover.
 * The list holds uploaded photo URLs and/or tokens for the built-in photos ("builtin:0".."builtin:2"),
 * so a manager can keep, reorder or remove the built-in photos alongside their own.
 *
 * Where photos appear (by position, wrapping round when a type has fewer):
 *   1st (cover): room type cards, the booking banner, Admin previews
 *   all: each room's page gallery and lightbox; room cards and stay cards rotate through them by room number
 *   2nd / 3rd: home page gallery tiles and the sign-in / sign-up pages (see those components)
 */
export const MAX_PHOTOS = 10;
export const BUILTIN_PREFIX = "builtin:";
export const DEFAULT_PHOTO_IDS = [0, 1, 2].map(i => `${BUILTIN_PREFIX}${i}`);

export interface LiveCategory extends Omit<Category, "photos" | "photoKeys"> {
  /** 1–10 photos in the manager's order; the first is the cover */
  photos: Photo[];
  /** Stored id of each photo: an uploaded URL or a builtin: token */
  photoIds: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export type CategorySettingsMap = Partial<Record<CategoryKey, CategorySettings>>;
export type LiveCategories = Record<CategoryKey, LiveCategory>;

export const isBuiltIn = (id: string) => id.startsWith(BUILTIN_PREFIX);

function resolve(key: CategoryKey, id: string): Photo | null {
  if (!isBuiltIn(id)) return id || null;
  return CATEGORIES[key].photos[Number(id.slice(BUILTIN_PREFIX.length))] ?? null;
}

export function liveCategory(key: CategoryKey, s?: CategorySettings): LiveCategory {
  const base = CATEGORIES[key];
  const stored = (s?.photos ?? []).filter((id): id is string => typeof id === "string" && !!resolve(key, id)).slice(0, MAX_PHOTOS);
  const photoIds = stored.length ? stored : DEFAULT_PHOTO_IDS;
  return {
    ...base,
    price: s?.price && s.price > 0 ? s.price : base.price,
    photos: photoIds.map(id => resolve(key, id)!),
    photoIds,
    updatedAt: s?.updatedAt,
    updatedBy: s?.updatedBy,
  };
}

export const liveCategories = (map: CategorySettingsMap = {}): LiveCategories =>
  Object.fromEntries(CATEGORY_LIST.map(c => [c.key, liveCategory(c.key, map[c.key])])) as LiveCategories;

export const DEFAULT_CATEGORIES = liveCategories();

/** The photo at a position (0 = cover), wrapping round when the type has fewer photos */
export const photoAt = (c: Pick<LiveCategory, "photos">, i: number) => c.photos[i % c.photos.length]!;

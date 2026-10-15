// Server-side copy of the room types' prices and photos, so the first HTML a visitor gets already has
// the managers' photos and prices (no flash of the built-in ones). Browsers then subscribe for live updates.
import { cacheLife, cacheTag } from "next/cache";
import type { CategorySettingsMap } from "./categories";
import type { CategoryKey, CategorySettings } from "./types";

export const CATEGORIES_TAG = "categories";

interface FirestoreValue {
  integerValue?: string;
  doubleValue?: number;
  stringValue?: string;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
}

/** `loaded` is false if Firestore couldn't be reached; the browser fills in then. */
export async function getInitialCategories(): Promise<{ map: CategorySettingsMap; loaded: boolean }> {
  "use cache";
  cacheTag(CATEGORIES_TAG);
  cacheLife("hours"); // also refreshed straight away when a manager saves (see /api/categories/revalidate)

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) return { map: {}, loaded: false };
  try {
    // categories/* is publicly readable in firestore.rules, so the REST API needs no sign-in
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/categories?key=${apiKey}`);
    if (!res.ok) return { map: {}, loaded: false };
    const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, FirestoreValue> }[] };
    const map: CategorySettingsMap = {};
    for (const d of body.documents ?? []) {
      const key = d.name.split("/").pop() as CategoryKey;
      const f = d.fields ?? {};
      map[key] = {
        price: Number(f.price?.integerValue ?? f.price?.doubleValue ?? 0),
        photos: (f.photos?.arrayValue?.values ?? []).map(v => v.stringValue).filter((v): v is string => !!v),
        updatedAt: f.updatedAt?.timestampValue ?? f.updatedAt?.stringValue,
        updatedBy: f.updatedBy?.stringValue,
      } satisfies CategorySettings;
    }
    return { map, loaded: true };
  } catch {
    return { map: {}, loaded: false };
  }
}

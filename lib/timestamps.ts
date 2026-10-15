// Times are written with Firebase's own clock (serverTimestamp), so nobody can backdate or fake them,
// and firestore.rules check each one equals request.time. They come back as Firestore Timestamps;
// the app works with ISO strings, so every read goes through withIsoDates.

type TimestampLike = { toDate(): Date };
const isTimestamp = (v: unknown): v is TimestampLike => !!v && typeof v === "object" && typeof (v as TimestampLike).toDate === "function";

/** Converts top-level Firestore Timestamps in a document to ISO strings (all of Keepr's time fields are top level) */
export function withIsoDates<T = Record<string, unknown>>(data: Record<string, unknown> | undefined): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) out[k] = isTimestamp(v) ? v.toDate().toISOString() : v;
  return out as T;
}

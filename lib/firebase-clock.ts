// Firebase's clock in the browser. A visitor's device clock can be wrong (or changed on purpose), so every "now" the
// app uses (today's date, hold countdowns, report windows, availability) is Firebase's time instead: the device clock
// plus an offset measured once from a Firestore read, whose `readTime` is Firebase's own clock.
// On the server, use firebaseServerNow() from lib/firebase-admin.ts.

let offsetMs = 0;
let synced = false;
let syncing: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Firebase's current time in ms. Equals the device clock until the first sync finishes (see syncFirebaseClock). */
export const firebaseNow = () => Date.now() + offsetMs;

export const isFirebaseClockSynced = () => synced;

/** Measures the device clock's offset from Firebase once per page load. Safe to call many times. */
export function syncFirebaseClock(): Promise<void> {
  syncing ??= (async () => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const database = `projects/${projectId}/databases/(default)`;
    const sentAt = Date.now();
    // categories/* is publicly readable, so this works before sign-in. A missing doc still returns readTime.
    const res = await fetch(`https://firestore.googleapis.com/v1/${database}/documents:batchGet?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documents: [`${database}/documents/categories/standard`] }),
    });
    const receivedAt = Date.now();
    const [first] = (await res.json()) as { readTime?: string }[];
    const readTime = first?.readTime ? Date.parse(first.readTime) : NaN;
    if (!res.ok || Number.isNaN(readTime)) throw new Error("Couldn't read Firebase's clock.");
    offsetMs = readTime - (sentAt + receivedAt) / 2; // the read happened roughly halfway through the round trip
    synced = true;
    listeners.forEach(l => l());
  })().catch(err => {
    syncing = null; // try again next time
    throw err;
  });
  return syncing;
}

/** Firebase's current time, waiting for the clock sync first. Falls back to the device clock if Firebase can't be reached. */
export async function firebaseTime(): Promise<number> {
  await syncFirebaseClock().catch(err => console.warn(err));
  return firebaseNow();
}

/** For useSyncExternalStore: notifies once the Firebase clock is synced */
export function subscribeToFirebaseClock(cb: () => void) {
  listeners.add(cb);
  syncFirebaseClock().catch(err => console.warn(err));
  return () => {
    listeners.delete(cb);
  };
}

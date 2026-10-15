// Every read and write the app makes goes through this file: Firebase Auth, Firestore and Storage,
// plus Keepr's own API routes for anything that needs the Admin SDK or the Bachs key.
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { buildBooking, planTransition, roomIsFree, SERVER_TIME, type DeskAction, type Hold } from "./booking-rules";
import { DEFAULT_PHOTO_IDS, liveCategory, MAX_PHOTOS, type CategorySettingsMap } from "./categories";
import { ACTIVE_BOOKING, CATEGORIES } from "./constants";
import { auth, COL, db, googleProvider, storage } from "./firebase";
import { firebaseTime } from "./firebase-clock";
import { resizeImage } from "./image";
import { withIsoDates } from "./timestamps";
import type {
  ActivityEntry,
  ActivityType,
  Actor,
  BachsBalance,
  Bank,
  BankDestination,
  ResolvedAccount,
  AppUser,
  AvailabilityQuery,
  Booking,
  CategoryKey,
  CategorySettings,
  NewBookingInput,
  Payment,
  Role,
  Room,
  RoomStatus,
  Unsubscribe,
} from "./types";
import { buildInventory, makeId, naira, nightsBetween, priceStay, rateOf } from "./utils";

/** Document data with Timestamps as ISO strings. Pending server times read as Firebase's estimate, never null. */
const dataOf = <T = Record<string, unknown>>(d: { data(o?: { serverTimestamps: "estimate" }): DocumentData | undefined }) => withIsoDates<T>(d.data({ serverTimestamps: "estimate" }));
const list = <T>(snap: QuerySnapshot<DocumentData>) => snap.docs.map(d => ({ id: d.id, ...dataOf(d) }) as T);
const newest = <T extends { createdAt?: string; paidAt?: string }>(a: T, b: T) =>
  (b.createdAt ?? b.paidAt ?? "").localeCompare(a.createdAt ?? a.paidAt ?? "");
const holdOf = (b: Pick<Booking, "roomId" | "checkIn" | "checkOut" | "status" | "createdAt">): Hold => ({
  roomId: b.roomId,
  checkIn: b.checkIn,
  checkOut: b.checkOut,
  status: b.status,
  createdAt: b.createdAt,
});
const must = <T>(v: T | null | undefined, msg: string): T => {
  if (v == null) throw new Error(msg);
  return v;
};

/* ====================================================================== AUTH */

async function loadProfile(user: User): Promise<AppUser | null> {
  const snap = await getDoc(doc(db!, COL.users, user.uid));
  return snap.exists() ? ({ ...dataOf(snap), uid: user.uid } as AppUser) : null;
}

/** Creates users/{uid} on first Google sign-in. New accounts are always customers. */
export async function ensureUserProfile(user: User): Promise<AppUser> {
  const existing = await loadProfile(user);
  if (existing) {
    await updateDoc(doc(db!, COL.users, user.uid), { lastActive: serverTimestamp() });
    return existing;
  }
  const now = new Date(await firebaseTime()).toISOString(); // shown until the saved profile (with Firebase's timestamps) loads
  const profile: AppUser = {
    uid: user.uid,
    name: user.displayName ?? user.email?.split("@")[0] ?? "Guest",
    email: user.email ?? "",
    photoURL: user.photoURL,
    role: "customer",
    createdAt: now,
    lastActive: now,
  };
  const { uid, ...data } = profile;
  await setDoc(doc(db!, COL.users, uid), { ...data, createdAt: serverTimestamp(), lastActive: serverTimestamp() });
  return profile;
}

/** Calls back with the signed-in user's profile (or null) now and whenever it changes */
export function onAuthChange(cb: (user: AppUser | null) => void): Unsubscribe {
  return onAuthStateChanged(auth!, async user => {
    if (!user) return cb(null);
    try {
      // On a first Google sign-in this fires before signInWithGoogle has created the profile, and it won't fire again,
      // so create it here too (it's idempotent). Email accounts (staff, admins) are created by the server with a profile.
      const google = user.providerData.some(p => p.providerId === "google.com");
      cb((await loadProfile(user)) ?? (google ? await ensureUserProfile(user) : null));
    } catch {
      cb(null);
    }
  });
}

export async function signInWithGoogle(): Promise<AppUser> {
  const cred = await signInWithPopup(auth!, googleProvider);
  return ensureUserProfile(cred.user);
}

/** Staff and admin sign-in. Signs straight back out if the account doesn't hold the console's role. */
export async function signInWithEmail(email: string, password: string, role: Exclude<Role, "customer">): Promise<AppUser> {
  if (!email || !password) throw new Error("Enter your work email and password.");
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth!, email, password);
  } catch {
    throw new Error("That email and password don't match an account.");
  }
  const profile = await loadProfile(cred.user);
  const allowed = role === "staff" ? profile?.role === "staff" || profile?.role === "admin" : profile?.role === "admin";
  if (!profile || !allowed) {
    await signOut(auth!);
    throw new Error(role === "admin" ? "This account is not an admin manager account." : "This account does not have front desk access.");
  }
  await updateDoc(doc(db!, COL.users, profile.uid), { lastActive: serverTimestamp() });
  return profile;
}

export async function signOutUser() {
  await signOut(auth!);
}

export async function updateMyProfile(uid: string, data: Pick<AppUser, "name" | "phone">) {
  await updateDoc(doc(db!, COL.users, uid), data);
}

/** ID token for calls to our own API routes */
async function authHeader(): Promise<Record<string, string>> {
  const token = await must(auth?.currentUser, "Please sign in again.").getIdToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/* ===================================================================== ROOMS */

export function subscribeToRooms(cb: (rooms: Room[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db!, COL.rooms), orderBy("number")), snap => cb(list<Room>(snap)));
}

export async function getRoom(id: string): Promise<Room | null> {
  const snap = await getDoc(doc(db!, COL.rooms, id));
  return snap.exists() ? ({ ...dataOf(snap), id: snap.id } as Room) : null;
}

async function liveHolds(checkIn: string): Promise<Hold[]> {
  // Only holds that end after the requested check-in can overlap it
  const snap = await getDocs(query(collection(db!, COL.holds), where("status", "in", ACTIVE_BOOKING), where("checkOut", ">", checkIn)));
  return snap.docs.map(d => dataOf<Hold>(d));
}

export async function getAvailableRooms({ checkIn, checkOut, category = "all" }: AvailabilityQuery = {}): Promise<Room[]> {
  const snap = await getDocs(query(collection(db!, COL.rooms), orderBy("number")));
  let rooms = list<Room>(snap);
  if (category !== "all") rooms = rooms.filter(r => r.category === category);
  if (!checkIn || !checkOut) return rooms;
  const [holds, now] = await Promise.all([liveHolds(checkIn), firebaseTime()]);
  return rooms.filter(r => roomIsFree(r.id, checkIn, checkOut, holds, now));
}

export async function isRoomAvailable(roomId: string, checkIn: string, checkOut: string) {
  const [holds, now] = await Promise.all([liveHolds(checkIn), firebaseTime()]);
  return roomIsFree(roomId, checkIn, checkOut, holds, now);
}

export async function setRoomStatus(room: Room, status: RoomStatus, actor: Actor) {
  const message = `${actor.name} set room ${room.number} to ${status}`;
  const batch = writeBatch(db!);
  batch.update(doc(db!, COL.rooms, room.id), { status });
  addActivity(batch, "room_status", message, actor);
  await batch.commit();
}

/** One-time setup for a fresh Firebase project: writes all 66 rooms and the three room types' prices. Admin only. */
export async function seedRooms() {
  const batch = writeBatch(db!);
  buildInventory().forEach(({ id, ...room }) => batch.set(doc(db!, COL.rooms, id), room));
  Object.values(CATEGORIES).forEach(c => batch.set(doc(db!, COL.categories, c.key), { price: c.price, photos: DEFAULT_PHOTO_IDS } satisfies CategorySettings, { merge: true }));
  await batch.commit();
}

/* ================================================================ ROOM TYPES */

/** Live price/photo overrides for the three room types (missing ones fall back to lib/constants.ts) */
export function subscribeToCategories(cb: (map: CategorySettingsMap) => void): Unsubscribe {
  return onSnapshot(
    collection(db!, COL.categories),
    snap => cb(Object.fromEntries(snap.docs.map(d => [d.id, dataOf<CategorySettings>(d)]))),
    () => cb({}), // unreadable (rules not deployed yet): show defaults
  );
}

async function getCategorySettings(key: CategoryKey): Promise<CategorySettings | undefined> {
  const snap = await getDoc(doc(db!, COL.categories, key));
  return snap.exists() ? dataOf<CategorySettings>(snap) : undefined;
}

/** The nightly price a new booking is charged at right now */
export const currentPrice = async (key: CategoryKey) => liveCategory(key, await getCategorySettings(key)).price;

async function saveCategory(key: CategoryKey, patch: Partial<CategorySettings>, actor: Actor, message: string) {
  const current = liveCategory(key, await getCategorySettings(key));
  const next: CategorySettings = {
    price: current.price,
    photos: current.photoIds,
    ...patch,
    updatedBy: actor.name,
  };
  const batch = writeBatch(db!);
  batch.set(doc(db!, COL.categories, key), { ...next, updatedAt: serverTimestamp() });
  addActivity(batch, "room_type_updated", message, actor);
  await batch.commit();
  // Refresh the server's cached copy so the next page load already shows the change
  fetch("/api/categories/revalidate", { method: "POST", headers: await authHeader() }).catch(() => {});
}

/** Admin only. New bookings use the new price; existing bookings keep the rate they were made at. */
export async function updateCategoryPrice(key: CategoryKey, price: number, actor: Actor) {
  if (!Number.isFinite(price) || price < 1000) throw new Error("Enter a nightly price of at least ₦1,000.");
  const old = await currentPrice(key);
  if (old === price) return;
  await saveCategory(key, { price: Math.round(price) }, actor, `${actor.name} changed the ${CATEGORIES[key].name} price from ${naira(old)} to ${naira(price)} per night`);
}

const removeUploads = (ids: string[]) => {
  ids.filter(u => u.includes("firebasestorage")).forEach(u => deleteObject(storageRef(storage!, u)).catch(() => {}));
};

/**
 * Admin only. Adds photos to the end of a room type's list (up to MAX_PHOTOS). Each photo is shrunk in the
 * browser and uploaded to Firebase Storage (rooms/{key}/...).
 */
export async function addCategoryPhotos(key: CategoryKey, files: File[], actor: Actor, onProgress?: (done: number, total: number) => void) {
  const current = liveCategory(key, await getCategorySettings(key));
  if (current.photoIds.length + files.length > MAX_PHOTOS)
    throw new Error(`A room type can have up to ${MAX_PHOTOS} photos. It has ${current.photoIds.length}, so you can add ${MAX_PHOTOS - current.photoIds.length} more.`);
  const urls: string[] = [];
  for (const [i, file] of files.entries()) {
    if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} is larger than 25 MB.`);
    const { blob } = await resizeImage(file);
    const objectRef = storageRef(storage!, `rooms/${key}/${makeId("photo")}.jpg`);
    await uploadBytes(objectRef, blob, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" });
    urls.push(await getDownloadURL(objectRef));
    onProgress?.(i + 1, files.length);
  }
  await saveCategory(key, { photos: [...current.photoIds, ...urls] }, actor, `${actor.name} added ${urls.length} photo${urls.length > 1 ? "s" : ""} to ${CATEGORIES[key].name} rooms`);
}

/** Admin only. Saves a new order, or removes photos (pass the ids to keep, cover first). At least one photo must stay. */
export async function setCategoryPhotos(key: CategoryKey, photoIds: string[], actor: Actor, message: string) {
  if (!photoIds.length) throw new Error("A room type needs at least one photo.");
  const before = liveCategory(key, await getCategorySettings(key)).photoIds;
  await saveCategory(key, { photos: photoIds.slice(0, MAX_PHOTOS) }, actor, message);
  removeUploads(before.filter(id => !photoIds.includes(id)));
}

/** Admin only. Puts the 3 built-in photos back and removes the uploaded ones. */
export async function restoreBuiltInPhotos(key: CategoryKey, actor: Actor) {
  await setCategoryPhotos(key, DEFAULT_PHOTO_IDS, actor, `${actor.name} restored the built-in ${CATEGORIES[key].name} photos`);
}

/* ================================================================== BOOKINGS */

export async function createBooking(input: NewBookingInput, user: AppUser): Promise<Booking> {
  const room = must(await getRoom(input.roomId), "That room no longer exists.");
  const data = buildBooking(input, room, user, await currentPrice(room.category), await firebaseTime());
  if (!(await isRoomAvailable(room.id, input.checkIn, input.checkOut)))
    throw new Error(`Room ${room.number} was just booked for those dates. Please pick another room.`);
  const msg = `${user.name} booked room ${room.number} (${data.code})`;
  const ref = doc(collection(db!, COL.bookings));
  const batch = writeBatch(db!);
  // Firebase's clock, not the browser's: the 15-minute hold runs from this time (firestore.rules require it)
  batch.set(ref, { ...data, createdAt: serverTimestamp() });
  batch.set(doc(db!, COL.holds, ref.id), { ...holdOf(data), createdAt: serverTimestamp() });
  addActivity(batch, "booking_created", msg, user);
  await batch.commit();
  return { id: ref.id, ...data };
}

export function subscribeToBooking(id: string, cb: (b: Booking | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db!, COL.bookings, id),
    snap => cb(snap.exists() ? ({ ...dataOf(snap), id: snap.id } as Booking) : null),
    () => cb(null),
  );
}

export function subscribeToMyBookings(uid: string, cb: (b: Booking[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db!, COL.bookings), where("userId", "==", uid)), snap => cb(list<Booking>(snap).sort(newest)));
}

/** Staff and admin: every booking */
export function subscribeToAllBookings(cb: (b: Booking[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db!, COL.bookings), orderBy("createdAt", "desc")), snap => cb(list<Booking>(snap)));
}

/** Guest details collected at checkout. Recalculates the total while the booking is unpaid. */
export async function updateBookingDetails(booking: Booking, details: Pick<Booking, "guestName" | "phone" | "arrivalWindow" | "airportPickup">) {
  if (booking.status !== "pending_payment") throw new Error("This booking is already paid.");
  const price = priceStay(rateOf(booking), nightsBetween(booking.checkIn, booking.checkOut), booking.category, details.airportPickup);
  const patch = { ...details, ...price };
  await updateDoc(doc(db!, COL.bookings, booking.id), patch);
}

async function runDeskAction(booking: Booking, action: DeskAction, actor: Actor) {
  const { patch, roomStatus, activity: log } = planTransition(booking, action, actor);
  const batch = writeBatch(db!);
  // Check-in and check-out times come from Firebase's clock
  const stamped = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === SERVER_TIME ? serverTimestamp() : v]));
  batch.update(doc(db!, COL.bookings, booking.id), stamped);
  batch.update(doc(db!, COL.holds, booking.id), { status: patch.status });
  if (roomStatus) batch.update(doc(db!, COL.rooms, booking.roomId), { status: roomStatus });
  if (action === "confirmPayment" && booking.paymentRef) batch.update(doc(db!, COL.payments, booking.paymentRef), { confirmedBy: actor.name });
  addActivity(batch, log.type, log.message, actor);
  await batch.commit();
}

export const confirmPayment = (b: Booking, actor: Actor) => runDeskAction(b, "confirmPayment", actor);
export const checkInGuest = (b: Booking, actor: Actor) => runDeskAction(b, "checkIn", actor);
export const checkOutGuest = (b: Booking, actor: Actor) => runDeskAction(b, "checkOut", actor);
export const cancelBooking = (b: Booking, actor: Actor) => runDeskAction(b, "cancel", actor);

/* ================================================================== PAYMENTS */

/**
 * Starts payment for a booking: our API route creates a Bachs checkout and we redirect to it;
 * the Bachs webhook marks the booking paid.
 */
export async function startCheckout(booking: Booking): Promise<{ redirectUrl?: string }> {
  const res = await fetch("/api/bachs/checkout", { method: "POST", headers: await authHeader(), body: JSON.stringify({ bookingId: booking.id }) });
  const body = await res.json().catch(() => ({}));
  // A reply without our JSON error means the server crashed before Keepr's code ran; the status helps find it in the logs
  if (!res.ok) throw new Error(body.error ?? `We couldn't start the payment (server error ${res.status}). Please try again.`);
  return { redirectUrl: body.checkoutUrl };
}

/**
 * Admin managers refund a cancelled, paid booking in full. Ask for the password first (confirmPassword).
 * Our API route sends the refund to Bachs and the refund webhook records the outcome.
 */
export async function refundBooking(booking: Booking): Promise<void> {
  await api("/api/bachs/refunds", { method: "POST", body: JSON.stringify({ bookingId: booking.id }) });
}

/**
 * Hotel-wide payments. Admin managers subscribe to all time; staff pass `sinceDays` (firestore.rules
 * only lets staff read payments from the last STAFF_PAYMENT_DAYS days, so their query must be limited too).
 */
export function subscribeToPayments(cb: (p: Payment[]) => void, sinceDays?: number): Unsubscribe {
  let stop: Unsubscribe | null = null;
  let cancelled = false;
  // The window starts from Firebase's time, so a wrong device clock can't widen or shift it
  firebaseTime().then(now => {
    if (cancelled) return;
    const q = sinceDays
      ? query(collection(db!, COL.payments), where("paidAt", ">=", Timestamp.fromMillis(now - sinceDays * 864e5)), orderBy("paidAt", "desc"))
      : query(collection(db!, COL.payments), orderBy("paidAt", "desc"));
    stop = onSnapshot(q, snap => cb(list<Payment>(snap)));
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

export function subscribeToMyPayments(uid: string, cb: (p: Payment[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db!, COL.payments), where("userId", "==", uid)), snap => cb(list<Payment>(snap).sort(newest)));
}

/* ================================================================== ACTIVITY */

function addActivity(batch: ReturnType<typeof writeBatch>, type: ActivityType, message: string, actor: Actor | AppUser) {
  batch.set(doc(db!, COL.activity, makeId("act")), { type, message, actorId: actor.uid, actorName: actor.name, createdAt: serverTimestamp() });
}

export function subscribeToActivity(cb: (a: ActivityEntry[]) => void, max = 40): Unsubscribe {
  return onSnapshot(query(collection(db!, COL.activity), orderBy("createdAt", "desc"), fsLimit(max)), snap => cb(list<ActivityEntry>(snap)));
}

/* ====================================================================== TEAM */

export function subscribeToTeam(cb: (team: AppUser[]) => void): Unsubscribe {
  const byRole = (a: AppUser, b: AppUser) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
  return onSnapshot(query(collection(db!, COL.users), where("role", "in", ["staff", "admin"])), snap =>
    cb(snap.docs.map(d => ({ ...dataOf(d), uid: d.id }) as AppUser).sort(byRole)),
  );
}

export interface NewTeamMember {
  name: string;
  email: string;
  role: Exclude<Role, "customer">;
  password: string;
}

/** Admin only. Runs on the server (Firebase Admin SDK) because client SDKs can't create other users. */
export async function createTeamMember(member: NewTeamMember) {
  if (!member.name.trim() || !/^\S+@\S+\.\S+$/.test(member.email)) throw new Error("Enter a name and a valid work email.");
  if (member.password.length < 8) throw new Error("The temporary password needs at least 8 characters.");
  const res = await fetch("/api/team", { method: "POST", headers: await authHeader(), body: JSON.stringify(member) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't add that team member.");
}

export async function deleteTeamMember(member: AppUser, actor: Actor) {
  if (member.uid === actor.uid) throw new Error("You can't remove your own account.");
  const res = await fetch(`/api/team?uid=${encodeURIComponent(member.uid)}`, { method: "DELETE", headers: await authHeader() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't remove that team member.");
}

export const categoryName = (b: Pick<Booking, "category">) => CATEGORIES[b.category].name;

/* ============================================================ PAYOUT ACCOUNTS */
// The hotel's bank accounts on Bachs. Admin managers only; every call goes through our server,
// which holds the Bachs key and never sends full account numbers to the browser.

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { ...(await authHeader()), ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
  return body as T;
}

/** Asks for the manager's password again. Required just before refunds and adding, removing or changing the default bank account. */
export async function confirmPassword(password: string) {
  if (!password) throw new Error("Enter your password.");
  const user = must(auth?.currentUser, "Please sign in again.");
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, password));
  } catch {
    throw new Error("That password isn't right.");
  }
}

export async function getPayoutOverview(): Promise<{ destinations: BankDestination[]; balances: BachsBalance[] }> {
  return api("/api/bachs/destinations");
}

export async function listBanks(): Promise<Bank[]> {
  return (await api<{ banks: Bank[] }>("/api/bachs/banks")).banks;
}

export async function lookupBankAccount(bankCode: string, accountNumber: string): Promise<ResolvedAccount> {
  return api("/api/bachs/banks/resolve", { method: "POST", body: JSON.stringify({ bankCode, accountNumber }) });
}

export async function addPayoutAccount(input: { bankCode: string; accountNumber: string; name: string }): Promise<BankDestination> {
  return (await api<{ destination: BankDestination }>("/api/bachs/destinations", { method: "POST", body: JSON.stringify(input) })).destination;
}

export async function renamePayoutAccount(id: string, name: string) {
  if (!name.trim()) throw new Error("Give the account a name.");
  await api(`/api/bachs/destinations/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export async function setDefaultPayoutAccount(id: string) {
  await api(`/api/bachs/destinations/${id}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) });
}

export async function removePayoutAccount(id: string) {
  await api(`/api/bachs/destinations/${id}`, { method: "DELETE" });
}

// Server-only Firebase Admin SDK. Used by API routes for work the browser must not do:
// marking bookings paid (Bachs webhook) and creating or deleting staff accounts.
import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { Role } from "./types";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

export const isAdminConfigured = Boolean(projectId && clientEmail && privateKey);

function adminApp() {
  if (!isAdminConfigured) throw new HttpError(503, "Firebase Admin is not configured on the server.");
  return getApps().length ? getApp() : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Verifies the caller's Firebase ID token and (optionally) their role. Returns uid, name and role. */
export async function requireUser(req: Request, roles?: Role[]) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Please sign in again.");
  let uid: string;
  let authTime: number;
  try {
    const decoded = await adminAuth().verifyIdToken(token, true); // true: reject tokens of disabled or signed-out users
    uid = decoded.uid;
    authTime = decoded.auth_time;
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
  const snap = await adminDb().collection("users").doc(uid).get();
  const role = snap.get("role") as Role | undefined;
  if (roles && (!role || !roles.includes(role))) throw new HttpError(403, "You don't have permission to do that.");
  return { uid, role: role ?? "customer", name: (snap.get("name") as string) ?? "Unknown", authTime };
}

let clock: { offsetMs: number; measuredAt: number } | null = null;

/**
 * Firebase's current time in ms, for server-side checks (hold expiry, recent sign-in). The server clock plus an offset
 * measured from a Firestore read, whose readTime is Firebase's own clock; re-measured every 10 minutes.
 */
export async function firebaseServerNow(): Promise<number> {
  if (!clock || Date.now() - clock.measuredAt > 10 * 60_000) {
    const sentAt = Date.now();
    const snap = await adminDb().doc("categories/standard").get();
    const receivedAt = Date.now();
    clock = { offsetMs: snap.readTime.toMillis() - (sentAt + receivedAt) / 2, measuredAt: receivedAt };
  }
  return Date.now() + clock.offsetMs;
}

/** How recently the user must have entered their password for sensitive changes (bank details) */
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

/** Throws unless the user typed their password in the last 10 minutes (the app asks for it again just before) */
export async function requireRecentSignIn(user: { authTime: number }, action = "change bank details") {
  // authTime is Firebase Auth's clock, so compare it with Firebase's time
  if ((await firebaseServerNow()) / 1000 - user.authTime > RECENT_SIGN_IN_SECONDS)
    throw new HttpError(401, `For your security, enter your password again to ${action}.`);
}

/** Turns thrown errors into JSON responses */
export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  return Response.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

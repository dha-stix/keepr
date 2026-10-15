// One-off setup for a new Firebase project, run with the Admin SDK keys in .env.local.
//
//   node scripts/setup.mjs rooms                              writes the 66 rooms and 3 room types (skips any that exist)
//   node scripts/setup.mjs account admin "Funmi Okonkwo" funmi@keepr.ng
//   node scripts/setup.mjs account staff "Tunde Bello" tunde@keepr.ng
//
// `account` creates the login (or resets its password if the email already exists) with a generated
// password, and saves the email and password to keepr-logins.local.txt instead of printing them.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";

process.loadEnvFile(".env.local");
const { FIREBASE_ADMIN_PROJECT_ID: projectId, FIREBASE_ADMIN_CLIENT_EMAIL: clientEmail } = process.env;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) throw new Error("Set the FIREBASE_ADMIN_* keys in .env.local first.");

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
const auth = getAuth();

// Mirrors CATEGORIES and buildInventory() in lib/constants.ts and lib/utils.ts (those import photos, which Node can't load)
const TYPES = [
  { key: "standard", range: [100, 148], price: 45000, wing: n => (n <= 124 ? "Garden wing · queen bed" : "Quiet wing · queen bed") },
  { key: "exclusive", range: [150, 198], price: 95000, wing: n => (n <= 174 ? "East wing · lagoon view" : "East wing · city view") },
  { key: "presidential", range: [200, 230], price: 250000, wing: n => (n <= 214 ? "Top floor · two bedrooms" : "Top floor · private terrace") },
];
const DEFAULT_PHOTO_IDS = ["builtin:0", "builtin:1", "builtin:2"];

async function seedRooms() {
  const batch = db.batch();
  let added = 0;
  for (const t of TYPES) {
    const cat = db.collection("categories").doc(t.key);
    if (!(await cat.get()).exists) {
      batch.set(cat, { price: t.price, photos: DEFAULT_PHOTO_IDS, updatedAt: FieldValue.serverTimestamp() });
      added++;
    }
    for (let n = t.range[0]; n <= t.range[1]; n += 2) {
      const room = db.collection("rooms").doc(`room-${n}`);
      if ((await room.get()).exists) continue; // keep live statuses (occupied, cleaning…) untouched
      batch.set(room, { number: n, category: t.key, status: "available", wing: t.wing(n) });
      added++;
    }
  }
  await batch.commit();
  console.log(added ? `Added ${added} documents (rooms and room types).` : "Rooms and room types were already there.");
}

async function createAccount(role, name, email) {
  if (role !== "admin" && role !== "staff") throw new Error('Role must be "admin" or "staff".');
  if (!name || !/^\S+@\S+\.\S+$/.test(email ?? "")) throw new Error('Usage: node scripts/setup.mjs account admin "Full Name" email@example.com');
  const password = randomBytes(9).toString("base64url"); // 12 characters
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName: name });
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    user = await auth.createUser({ email, password, displayName: name });
  }
  await db.collection("users").doc(user.uid).set({ name, email, role, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  appendFileSync("keepr-logins.local.txt", `${role === "admin" ? "Admin manager" : "Staff"}  ${name}\n  sign in: ${role === "admin" ? "/admin/login" : "/staff/login"}\n  email: ${email}\n  password: ${password}\n\n`);
  console.log(`${role} account ready for ${email}. Password saved to keepr-logins.local.txt.`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "rooms") await seedRooms();
else if (command === "account") await createAccount(...args);
else console.log("Commands: rooms | account <admin|staff> <name> <email>");

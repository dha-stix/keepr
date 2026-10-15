// Security rules tests for firestore.rules. Needs Java 21+ for the Firebase emulator.
// Run with:  npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";

let env;
const dayFromNow = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const hoursAgo = h => Timestamp.fromMillis(Date.now() - h * 3600_000);

/** A valid new booking by `uid` for Exclusive room 164 (₦95,000) */
const booking = (uid, over = {}) => ({
  code: "KPR-TEST",
  userId: uid,
  guestName: "Ada Guest",
  guestEmail: "ada@example.com",
  phone: "",
  roomId: "room-164",
  roomNumber: 164,
  category: "exclusive",
  checkIn: dayFromNow(3),
  checkOut: dayFromNow(5),
  nights: 2,
  guests: 2,
  nightlyRate: 95000,
  subtotal: 190000,
  extras: 0,
  vat: 14250,
  total: 204250,
  status: "pending_payment",
  createdAt: serverTimestamp(), // Firebase's clock; the 15-minute hold runs from here
  ...over,
});
const holdOf = b => ({ roomId: b.roomId, checkIn: b.checkIn, checkOut: b.checkOut, status: b.status, createdAt: b.createdAt });

before(async () => {
  env = await initializeTestEnvironment({ projectId: "keepr-rules-test", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/guest"), { name: "Ada Guest", email: "ada@example.com", role: "customer" });
    await setDoc(doc(db, "users/other"), { name: "Bayo Other", email: "bayo@example.com", role: "customer" });
    await setDoc(doc(db, "users/staff"), { name: "Tunde Bello", email: "tunde@keepr.com", role: "staff" });
    await setDoc(doc(db, "users/admin"), { name: "Funmi Okonkwo", email: "funmi@keepr.com", role: "admin" });
    await setDoc(doc(db, "rooms/room-164"), { number: 164, category: "exclusive", status: "available", wing: "East wing" });
    await setDoc(doc(db, "rooms/room-210"), { number: 210, category: "presidential", status: "available", wing: "Top floor" });
    await setDoc(doc(db, "categories/exclusive"), { price: 95000, photos: ["builtin:0"] });
  });
});

const as = uid => env.authenticatedContext(uid).firestore();

/** Creates booking + hold together, the way the app does */
async function book(db, id, data) {
  const batch = writeBatch(db);
  batch.set(doc(db, "bookings", id), data);
  batch.set(doc(db, "holds", id), holdOf(data));
  return batch.commit();
}

async function seedBooking(id, data) {
  data = { ...data, createdAt: data.createdAt?.isEqual ? data.createdAt : Timestamp.now() };
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), "bookings", id), data);
    await setDoc(doc(ctx.firestore(), "holds", id), holdOf(data));
  });
}

describe("creating bookings", () => {
  it("accepts a valid booking", () => assertSucceeds(book(as("guest"), "b1", booking("guest"))));
  it("rejects a Presidential room labelled as a cheaper type", () =>
    assertFails(book(as("guest"), "b1", booking("guest", { roomId: "room-210", roomNumber: 210, category: "exclusive" }))));
  it("rejects a made-up nightly rate", () => assertFails(book(as("guest"), "b1", booking("guest", { nightlyRate: 1000 }))));
  it("rejects booking for someone else", () => assertFails(book(as("guest"), "b1", booking("other"))));
  it("rejects too many guests for the room type", () => assertFails(book(as("guest"), "b1", booking("guest", { guests: 3 }))));
  it("rejects a booking created as already paid", () => assertFails(book(as("guest"), "b1", booking("guest", { status: "paid" }))));
  it("rejects extra fields like confirmedBy", () => assertFails(book(as("guest"), "b1", booking("guest", { confirmedBy: "Me" }))));
  it("rejects a booking time other than Firebase's (a backdated or future hold)", async () => {
    await assertFails(book(as("guest"), "b1", booking("guest", { createdAt: hoursAgo(-24) })));
    await assertFails(book(as("guest"), "b2", booking("guest", { createdAt: new Date().toISOString() })));
  });
  it("rejects past dates", () => assertFails(book(as("guest"), "b1", booking("guest", { checkIn: dayFromNow(-5), checkOut: dayFromNow(-3) }))));
});

describe("front desk", () => {
  it("cannot mark an unpaid booking paid", async () => {
    await seedBooking("b1", booking("guest"));
    await assertFails(updateDoc(doc(as("staff"), "bookings/b1"), { status: "paid" }));
  });
  it("cannot skip confirming payment", async () => {
    await seedBooking("b1", booking("guest", { status: "paid" }));
    await assertFails(updateDoc(doc(as("staff"), "bookings/b1"), { status: "checked_in" }));
  });
  it("must use Firebase's time for check-in", async () => {
    await seedBooking("b1", booking("guest", { status: "confirmed" }));
    await assertFails(updateDoc(doc(as("staff"), "bookings/b1"), { status: "checked_in", checkedInAt: hoursAgo(5) }));
    await assertSucceeds(updateDoc(doc(as("staff"), "bookings/b1"), { status: "checked_in", checkedInAt: serverTimestamp() }));
  });
  it("can confirm a paid booking", async () => {
    await seedBooking("b1", booking("guest", { status: "paid" }));
    const db = as("staff");
    const batch = writeBatch(db);
    batch.update(doc(db, "bookings/b1"), { status: "confirmed", confirmedBy: "Tunde Bello" });
    batch.update(doc(db, "holds/b1"), { status: "confirmed" });
    await assertSucceeds(batch.commit());
  });
  it("cannot change a booking's price", async () => {
    await seedBooking("b1", booking("guest", { status: "paid" }));
    await assertFails(updateDoc(doc(as("staff"), "bookings/b1"), { status: "confirmed", total: 1 }));
  });
  it("can list the last 8 days of payments, but not older ones", async () => {
    const db = as("staff");
    const since = days => query(collection(db, "payments"), where("paidAt", ">=", Timestamp.fromMillis(Date.now() - days * 864e5)));
    await assertSucceeds(getDocs(since(8)));
    await assertFails(getDocs(since(30)));
  });
  it("can only change a room's status", async () => {
    await assertSucceeds(updateDoc(doc(as("staff"), "rooms/room-164"), { status: "cleaning" }));
    await assertFails(updateDoc(doc(as("staff"), "rooms/room-164"), { category: "standard" }));
  });
});

describe("guests cancelling", () => {
  it("cannot free a room while the booking stays paid", async () => {
    await seedBooking("b1", booking("guest", { status: "paid" }));
    await assertFails(updateDoc(doc(as("guest"), "holds/b1"), { status: "cancelled" }));
  });
  it("can cancel a paid booking before check-in day, with its hold", async () => {
    await seedBooking("b1", booking("guest", { status: "paid" }));
    const db = as("guest");
    const batch = writeBatch(db);
    batch.update(doc(db, "bookings/b1"), { status: "cancelled" });
    batch.update(doc(db, "holds/b1"), { status: "cancelled" });
    await assertSucceeds(batch.commit());
  });
  it("cannot cancel a paid booking on or after check-in day", async () => {
    await seedBooking("b1", booking("guest", { status: "paid", checkIn: dayFromNow(-1), checkOut: dayFromNow(1) }));
    await assertFails(updateDoc(doc(as("guest"), "bookings/b1"), { status: "cancelled" }));
  });
  it("cannot touch another guest's booking", async () => {
    await seedBooking("b1", booking("guest"));
    await assertFails(getDoc(doc(as("other"), "bookings/b1")));
    await assertFails(updateDoc(doc(as("other"), "bookings/b1"), { status: "cancelled" }));
  });
});

describe("activity log, roles and room types", () => {
  it("rejects activity entries under someone else's name", () =>
    assertFails(setDoc(doc(as("guest"), "activity/a1"), { type: "booking_created", message: "x", actorId: "guest", actorName: "Funmi Okonkwo", createdAt: serverTimestamp() })));
  it("rejects guests logging desk actions", () =>
    assertFails(setDoc(doc(as("guest"), "activity/a1"), { type: "payment_confirmed", message: "x", actorId: "guest", actorName: "Ada Guest", createdAt: serverTimestamp() })));
  it("activity times must be Firebase's", async () => {
    await assertFails(setDoc(doc(as("guest"), "activity/a1"), { type: "booking_created", message: "x", actorId: "guest", actorName: "Ada Guest", createdAt: hoursAgo(48) }));
    await assertSucceeds(setDoc(doc(as("guest"), "activity/a2"), { type: "booking_created", message: "x", actorId: "guest", actorName: "Ada Guest", createdAt: serverTimestamp() }));
  });
  it("profile times must be Firebase's", async () => {
    await assertFails(updateDoc(doc(as("guest"), "users/guest"), { lastActive: hoursAgo(1) }));
    await assertSucceeds(updateDoc(doc(as("guest"), "users/guest"), { lastActive: serverTimestamp() }));
  });
  it("nobody can promote themselves", () => assertFails(updateDoc(doc(as("guest"), "users/guest"), { role: "admin" })));
  it("only admins change prices", async () => {
    await assertFails(setDoc(doc(as("staff"), "categories/exclusive"), { price: 1000, photos: [], updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(as("admin"), "categories/exclusive"), { price: 100000, photos: ["builtin:0"], updatedAt: serverTimestamp() }));
  });
});

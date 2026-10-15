# Keepr

Room booking and front desk platform for a hotel with 66 rooms in three categories. Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Framer Motion and Firebase. Payments go through Bachs.

| Category     | Rooms (even numbers) | Count | Guests per room | Price / night |
| ------------ | -------------------- | ----- | --------------- | ------------- |
| Standard     | 100 – 148            | 25    | 2               | ₦45,000       |
| Exclusive    | 150 – 198            | 25    | 2               | ₦95,000       |
| Presidential | 200 – 230            | 16    | 4               | ₦250,000      |

Admin managers change each room type's **price and photos** in **Admin → Rooms**. The prices above and the photos in `/images` are the defaults until they do. Room ranges, VAT (7.5%), the hold time (15 min) and the airport pickup fee live in `lib/constants.ts`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Until the Firebase web keys are in `.env.local` the app shows a setup screen listing what is missing. Follow **Connect Firebase** and **Connect Bachs** below.

## Pages

| Route | Who | What |
| --- | --- | --- |
| `/` | Everyone | Home: hero search, highlights, room categories, services, how it works, gallery and reviews, call to action |
| `/rooms`, `/rooms/[id]` | Everyone | Availability search and filters; room detail with gallery lightbox and live pricing |
| `/auth/login`, `/auth/register` | Guests | Google sign-in / sign-up |
| `/checkout/[bookingId]` | Guests | Guest details, Bachs payment, 15-minute hold, booking code keycard |
| `/dashboard` (+ `/bookings`, `/payments`, `/profile`) | Guests | Current stay with progress, history, receipts, cancel |
| `/staff/login`, `/staff/dashboard` (+ `/rooms`, `/bookings`, `/payments`) | Staff, admins | Arrivals queue: confirm payment → check in → check out; room board; payments to confirm |
| `/admin/login`, `/admin/dashboard` (+ `/bookings`, `/payments`, `/rooms`, `/team`, `/activity`) | Admin managers | Revenue, occupancy, live activity, all payments (CSV export), team management |

A booking moves through: **pending_payment → paid** (Bachs webhook) **→ confirmed** (front desk confirms the payment) **→ checked_in → checked_out**. Check-in is locked until the desk confirms the payment.

## Project structure

```
app/                 Routes only; each page renders components
  api/bachs/         checkout (start payment) and webhook (mark paid)
  api/team/          create / delete staff and admin accounts (Admin SDK)
components/          All page sections and UI, grouped by area
  home/ rooms/ auth/ checkout/ dashboard/ staff/ admin/ layout/ ui/
images/              Hotel photography + index.ts (import photos from here)
lib/
  firebase.ts        Firebase client setup
  firebase-actions.ts  Every read/write the app makes (Firebase Auth, Firestore, Storage, Keepr's API routes)
  firebase-admin.ts  Server-only Admin SDK + auth checks for API routes
  booking-rules.ts   Booking life cycle, pricing and availability rules, shared by client and server
  bachs.ts           Bachs adapter (the only file that talks to Bachs)
  constants.ts types.ts utils.ts stats.ts hooks.ts receipt.ts
styles/              globals.css (theme tokens), components.css, animations.css
firestore.rules      Security rules (roles enforced here)
firestore.indexes.json
```

## Connect Firebase

1. Create a Firebase project. Enable **Authentication → Google** and **Authentication → Email/Password**. Add your domain to Authorized domains.
2. Create a **Firestore** database.
3. Copy `.env.example` to `.env.local` and fill in the web app config and a service account (Project settings → Service accounts → Generate new private key).
4. Enable **Storage**, then deploy rules and indexes: `firebase deploy --only firestore,storage` (uses `firebase.json`).
5. Write the rooms: `npm run setup -- rooms` (the 66 rooms and three room types; anything already there is left alone).
6. **First admin:** `npm run setup -- account admin "Full Name" you@example.com`. It creates the login with a generated password and saves it to `keepr-logins.local.txt` (git-ignored). Sign in at `/admin/login`. Use `account staff …` for a front desk login.
7. Add staff and other admins from **Admin → Team** (each gets a temporary password you share with them).

## Connect Bachs

The integration follows the [Bachs docs](https://docs.bachs.io) and lives in `lib/bachs.ts`, `app/api/bachs/checkout` and `app/api/bachs/webhook`.

1. In the Bachs dashboard, copy a **sandbox** secret key (`sk_sandbox_...`) into `BACHS_SECRET_KEY`. Keep `BACHS_API_URL=https://sandbox-api.bachs.io`.
2. Developer Portal → Webhooks → **Add destination**: `https://<your-domain>/api/bachs/webhook`, subscribed to `collection.succeeded`. Copy its signing secret into `BACHS_WEBHOOK_SECRET`.
3. Set `APP_URL` to your public address. Bachs refuses `localhost` return URLs, so to test locally use a tunnel (or the Bachs CLI, which forwards webhooks to localhost).
4. To go live, swap in an `sk_live_` key, set `BACHS_API_URL=https://api.bachs.io`, and use the live endpoint's signing secret.

How a payment flows:

- **Checkout:** the server prices the stay again from `lib/constants.ts` (the browser can't change the amount) and creates a checkout session with a raw `pricing` amount in NGN. The session expires when the room hold does, so nobody pays for a released room. The guest is sent to Bachs' hosted checkout (card, bank transfer and any other method your account has).
- **Webhook:** `collection.succeeded` is verified with `X-Bachs-Signature-V2` (HMAC-SHA256 of `timestamp.body`, 5-minute tolerance, any `v1=` accepted during secret rotation). Each event id is stored in `webhook_events`, so repeated deliveries are ignored. The booking is marked paid only if the status is `SUCCEEDED`, `ACCEPTED` or `OVERPAID`, the currency is NGN and the amount covers the total. Anything less is logged in the activity feed for a manager instead.
- The payment record keeps the Bachs charge id, method, processing fee and settled amount.

## Room prices and photos

- **Admin → Rooms** has an editor for each room type: set the nightly price and manage **up to 10 photos**. You can upload (drag and drop or choose files), reorder, set the cover and remove photos, or go back to the 3 built-in photos. The built-in photos can be kept alongside your own.
- Every room photo on the site comes from these lists (see `lib/categories.ts`):
  - **Cover (1st photo):** room type cards and the booking banner.
  - **All photos:** each room's gallery and lightbox. Room cards and guests' stay cards rotate through them by room number.
  - **2nd and 3rd photos:** the home page gallery and the sign-in and sign-up pages.
- Photos are resized in the browser to 1600 px JPEGs and uploaded to Firebase Storage under `rooms/{type}/`. The list is saved in Firestore `categories/{type}`.
- Pages update live. The server also sends the current photos and prices with the first page load, refreshed when a manager saves, so visitors never see the built-in photos flash first.
- Each booking stores the nightly rate it was made at (`nightlyRate`). Changing a price only affects new bookings. Checkout and the Bachs webhook charge the stored rate.
- The rules enforce this: only admin managers can write `categories` or upload to Storage, and a guest's new booking is only accepted if its `nightlyRate` matches the room type's current price.
- Deploy Storage rules too: `firebase deploy --only firestore,storage`. Make sure Storage is enabled and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` is set.

## Bank details (payouts)

**Admin → Bank details** (`/admin/payouts`) manages the bank accounts the hotel's Bachs balance pays out to. In Bachs these are called payout destinations.

- **Balance:** shows the NGN balance available to pay out and the amount still settling (`GET /v1/balances`).
- **Add an account:**
  - Pick the bank from Bachs' list of Nigerian banks (`GET /v1/reference/banks?country=NG`) and type the 10-digit number.
  - The account holder's name is looked up straight away (`POST /v1/misc/bank-accounts/resolve`). The account is only saved (`POST /v1/payouts/destinations`) if the lookup succeeds.
  - Bachs then reviews it. It shows "In review" until approved (usually within 48 hours), and the page checks back by itself.
- **Make default:** automatic payouts go to the default account. Only approved accounts can be made default (`PATCH … { is_default: true }`).
- **Rename:** changes the name shown in Keepr (`PATCH … { name }`). Like the default flag, this never affects Bachs' approval.
- **Remove:** deletes the account on Bachs (`DELETE /v1/payouts/destinations/{id}`).
- **To change an account number,** add the new account and remove the old one. Bachs would otherwise send the edited account back for review.

How it's protected:
- Only admin managers can use it. Every call goes through Keepr's server, which holds the Bachs key.
- Adding, removing or changing the default account asks for the manager's password, and the server rejects the change unless they entered it in the last 10 minutes.
- Account numbers are masked (••1234) before they reach the browser.
- Every change is written to the activity log.

Payouts themselves are sent from the Bachs dashboard (**Balances → Withdraw**) or by automatic payouts there. Your Bachs key needs the `payouts:read`, `payouts:write` and `balance:read` permissions.

## Payments reporting

- **Staff** (`/staff/payments`): payments waiting for desk confirmation, then payments for today, any single day, or the last 7 days, with daily totals, method breakdown and CSV export. The front desk also shows what was collected today.
- **Admin managers** (`/admin/payments`): the same, plus the last 30 days and **all time** (monthly revenue chart and every day's totals), Bachs fees and settled amounts.
- Firestore rules enforce it: staff can only read payments from the last 8 days; admin managers can read all of them.

## Link previews

When someone shares a Keepr link on WhatsApp, iMessage, X, Facebook, LinkedIn or Slack, a 1200×630 branded preview image is shown:

| Page | Preview image |
| --- | --- |
| Home (and any page without its own) | Hotel photo, headline and the three room prices (`app/opengraph-image.tsx`) |
| `/rooms` | The three room types' cover photos with prices (`app/rooms/opengraph-image.tsx`) |
| `/rooms/[id]` | That room's photo, number, price, size and guests (`app/rooms/[id]/opengraph-image.tsx`) |

- The images are generated by the server and always use the managers' current photos and prices.
- They share one layout in `lib/share-image.tsx`, with the brand fonts in `assets/fonts`.
- **Set `APP_URL` to your domain in production.** Preview links must be absolute URLs; on Vercel the deployment URL is used if it's missing.
- After deploying, check a link with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) or [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/). They also clear old cached previews.

## Security rules and tests

`firestore.rules` is where the roles are enforced. In short:
- **Guests:**
  - They can only create unpaid bookings for themselves.
  - The room type must match the real room, the nightly rate must be that type's current price, and the guest count must be within the room's limit.
  - Dates must be today or later, and the hold lasts at most 15 minutes.
  - They can cancel unpaid bookings any time, and paid ones until check-in day.
- **Staff:** they can only move a booking one step: paid → confirmed → checked in → checked out, or cancel it. They can only change a room's status.
- **Payments:** only the server (the Bachs webhook) can mark a booking paid or create a payment.
- **Activity log:** entries must be written under the signed-in person's own name, and guests can only log their own bookings and cancellations.

**Times always come from Firebase's clock.**
- Every time Keepr saves uses `serverTimestamp()` in the app or `FieldValue.serverTimestamp()` on the server, never the visitor's or server's own clock. That includes booking, payment and refund times, check-in and check-out, last active, activity log entries and room type updates.
- The rules require each of those times to equal `request.time`, so nobody can backdate or fake one.
- The 15-minute unpaid hold runs from Firebase's booking time.
- Times come back as Firestore Timestamps and are turned into dates in one place (`lib/timestamps.ts`).
- "Now" is Firebase's time too: today's date, the hold countdown, availability, report windows and the password-recency check. The browser measures its offset from Firebase once per page load (`lib/firebase-clock.ts`, from a Firestore read's `readTime`); API routes do the same with the Admin SDK (`firebaseServerNow()` in `lib/firebase-admin.ts`).
- "Today" is the hotel's day in Lagos time (`HOTEL.timeZone`), whatever time zone the visitor's device is set to. Payments are grouped into days the same way.

`tests/firestore.rules.test.mjs` checks all of this against the Firebase emulator. It needs Java 21 or newer:

```bash
npm run test:rules
```

A guest who cancels a paid booking sees that the hotel will refund them. Managers see **Refund due** on that booking and an entry in the activity log. The refund itself is sent from the Bachs dashboard.

## Scripts

```bash
npm run dev     # development
npm run build   # production build
npm run start   # serve the build
npm run lint
npm run test:rules   # security rules tests (needs Java 21+)
```

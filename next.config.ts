import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// The Firebase web config is baked into the browser bundle at build time, so a build without it can't work
const FIREBASE_WEB_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: "/staff", destination: "/staff/dashboard", permanent: false },
      { source: "/admin", destination: "/admin/dashboard", permanent: false },
    ];
  },
  images: {
    // Google profile photos for signed-in guests
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Room photos uploaded by managers to Firebase Storage
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default function config(phase: string): NextConfig {
  const missing = FIREBASE_WEB_KEYS.filter(k => !process.env[k]);
  if (phase === PHASE_PRODUCTION_BUILD && missing.length) {
    throw new Error(`Keepr can't be built without Firebase. Add these to .env.local (see .env.example):\n  ${missing.join("\n  ")}`);
  }
  return nextConfig;
}

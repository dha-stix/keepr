import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, IBM_Plex_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/layout/Providers";
import { getInitialCategories } from "@/lib/categories-server";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "@/styles/globals.css";

const bodoni = Bodoni_Moda({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-bodoni", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  // Link previews need absolute URLs; preview images come from the opengraph-image files
  metadataBase: new URL(SITE_URL),
  title: { default: "Keepr · Book a room in Lekki", template: "%s · Keepr" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_NG",
    title: "Keepr · Book a room in Lekki",
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Keepr · Book a room in Lekki",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#10231e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const categories = await getInitialCategories();
  return (
    <html lang="en" className={`${bodoni.variable} ${outfit.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">
        <Providers categories={categories}>{children}</Providers>
      </body>
    </html>
  );
}

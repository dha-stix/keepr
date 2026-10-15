/**
 * The site's public address. Link previews (WhatsApp, iMessage, Slack, X, Facebook, LinkedIn) need absolute URLs,
 * so set APP_URL to your domain in production. Vercel deployments fall back to their own URL.
 */
export const SITE_URL = (
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Keepr";
/** Share details for a page. Pages that set openGraph replace the site-wide one, so this keeps the shared fields. */
export const shareMeta = ({ title, description, url }: { title: string; description: string; url: string }) => ({
  openGraph: { type: "website" as const, siteName: SITE_NAME, locale: "en_NG", title, description, url },
  twitter: { card: "summary_large_image" as const, title, description },
});

export const SITE_DESCRIPTION = "Book Standard, Exclusive or Presidential rooms in Lekki, pay securely online and walk straight to your key.";

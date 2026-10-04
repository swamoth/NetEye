/**
 * Where this deployment lives. Metadata, the social card and the sitemap need absolute URLs,
 * and a relative one makes a crawler drop the card.
 *
 * NEXT_PUBLIC_SITE_URL wins (set it for a custom domain). On Vercel, VERCEL_PROJECT_PRODUCTION_URL
 * is the production host and VERCEL_URL the per-deployment host, so preview deployments advertise
 * themselves. Locally it falls back to the dev server.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

import type { MetadataRoute } from 'next';
import { siteUrl } from '@/app/utils/site';

/** Crawlers may read the app and the feed; the JSON API is excluded, it has no pages to index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

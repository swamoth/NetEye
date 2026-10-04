import type { MetadataRoute } from 'next';
import { siteUrl } from '@/app/utils/site';

/** One page and one feed. Deep links carry query parameters, which a sitemap does not list. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/api/feed`, changeFrequency: 'hourly', priority: 0.5 },
  ];
}

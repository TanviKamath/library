/**
 * Utility to proxy remote image URLs through local backend to prevent CORS/timeout issues
 * and provide reliable caching.
 */
export function getProxiedImageUrl(url) {
  if (!url) return null;
  if (url.includes('/api/v1/proxy-image')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `/api/v1/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

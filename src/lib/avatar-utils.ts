/**
 * Get avatar URL with automatic proxy for LinkedIn images
 * LinkedIn images are often blocked by CORS, so we proxy them through our API
 */
export function getAvatarUrl(originalUrl?: string): string | undefined {
  if (!originalUrl || !originalUrl.trim()) return undefined;
  
  const trimmedUrl = originalUrl.trim();
  
  // Check if it's a LinkedIn URL
  if (trimmedUrl.includes('linkedin.com') || trimmedUrl.includes('licdn.com')) {
    // Use our proxy endpoint
    const encodedUrl = encodeURIComponent(trimmedUrl);
    return `/api/image-proxy?url=${encodedUrl}`;
  }
  
  // Return original URL for non-LinkedIn images
  return trimmedUrl;
}


import { headers } from 'next/headers';

/**
 * Get base URL for the application
 * Prefers APP_URL, then VERCEL_URL, then headers
 */
export async function getBaseUrl(): Promise<string> {
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback to headers (for development and edge cases)
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  
  return `${proto}://${host}`;
}

/**
 * Assert that base URL doesn't contain localhost/127.0.0.1 in production
 * Throws error if misconfigured
 */
export function assertProdBaseUrl(url: string): void {
  if (process.env.VERCEL && /localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(`MISCONFIGURED_BASE_URL: ${url} - localhost/127.0.0.1 not allowed in production`);
  }
}


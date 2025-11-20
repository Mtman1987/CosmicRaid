'use client';

/**
 * Client-side helper to inject x-user-id from localStorage into fetch requests.
 *
 * Usage:
 *   import { fetchWithUser } from '@/lib/fetch-with-user';
 *   await fetchWithUser('/api/whatever', { method: 'POST', body: JSON.stringify(data) });
 */
export async function fetchWithUser(input: RequestInfo | URL, init: RequestInit = {}) {
  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
  const headers = new Headers(init.headers || {});
  if (userId) {
    headers.set('x-user-id', userId);
  }
  return fetch(input, { ...init, headers });
}

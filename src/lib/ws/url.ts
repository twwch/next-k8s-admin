/**
 * Derive WebSocket URL from browser location at runtime,
 * so it works in any deployment (Docker, reverse proxy, etc.)
 * without needing NEXT_PUBLIC_WS_URL at build time.
 */
export function getWsUrl(): string {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

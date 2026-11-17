/**
 * App-shell service worker. Bundled to /sw.js by vite/pwaPlugin.ts, which injects the build id and
 * the precache list. It stores only requests that decideCache() accepts, so an authenticated API
 * response or a signed media URL can never end up in Cache Storage.
 */
import { decideCache, SHELL_CACHE_PREFIX } from './cachePolicy';

declare const __BUILD_ID__: string;
declare const __PRECACHE_URLS__: string[];

interface WorkerEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEventLike extends WorkerEvent {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}
interface MessageEventLike extends Event {
  data: unknown;
}
interface WorkerScope {
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: string, listener: (event: never) => void): void;
}

const sw = self as unknown as WorkerScope;
const CACHE_NAME = `${SHELL_CACHE_PREFIX}${__BUILD_ID__}`;
const SHELL_URL = '/';

// A new worker waits; the page asks it to take over only after the member clicks Update.
sw.addEventListener('install', ((event: WorkerEvent) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(__PRECACHE_URLS__)));
}) as (event: never) => void);

sw.addEventListener('activate', ((event: WorkerEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => sw.clients.claim()),
  );
}) as (event: never) => void);

sw.addEventListener('message', ((event: MessageEventLike) => {
  const data = event.data as { type?: string } | null;
  if (data && data.type === 'SKIP_WAITING') void sw.skipWaiting();
}) as (event: never) => void);

async function shellFallback(): Promise<Response> {
  const cached = await caches.match(SHELL_URL, { cacheName: CACHE_NAME });
  return cached ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
  return response;
}

sw.addEventListener('fetch', ((event: FetchEventLike) => {
  const { request } = event;
  const decision = decideCache({
    url: request.url,
    method: request.method,
    origin: sw.location.origin,
    hasAuthorization: request.headers.has('Authorization'),
  });

  // Page navigations: network first so a deploy is seen at once, the cached shell when offline.
  if (request.mode === 'navigate' && request.method === 'GET' && new URL(request.url).origin === sw.location.origin) {
    event.respondWith(fetch(request).catch(shellFallback));
    return;
  }
  if (decision.cacheable) {
    event.respondWith(cacheFirst(request));
  }
  // Anything else goes straight to the network, untouched and unstored.
}) as (event: never) => void);

// Simple PWA Service Worker - Focused on app shell caching only
const CACHE_NAME = 'worksheet-app-v3';
const STATIC_CACHE_NAME = 'worksheet-static-v3';

// Essential files for offline app shell
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Patterns for API requests that should NEVER be cached
const API_PATTERNS = [
  /^https:\/\/.*\.supabase\.co/,
  /\/rest\/v1\//,
  /\/auth\/v1\//,
  /\/functions\/v1\//,
  /\/storage\/v1\//
];

// Discover and cache essential assets
async function cacheEssentialAssets() {
  try {
    const response = await fetch('/');
    if (!response.ok) return;
    
    const html = await response.text();
    
    // Extract CSS and JS assets
    const cssMatches = html.match(/<link[^>]+href="([^"]+\.css[^"]*)"[^>]*>/g) || [];
    const jsMatches = html.match(/<script[^>]+src="([^"]+\.js[^"]*)"[^>]*>/g) || [];
    
    const assets = [...STATIC_ASSETS];
    
    cssMatches.forEach(match => {
      const href = match.match(/href="([^"]+)"/)?.[1];
      if (href && href.startsWith('/')) assets.push(href);
    });
    
    jsMatches.forEach(match => {
      const src = match.match(/src="([^"]+)"/)?.[1];
      if (src && src.startsWith('/')) assets.push(src);
    });
    
    const cache = await caches.open(STATIC_CACHE_NAME);
    for (const asset of assets) {
      try {
        await cache.add(asset);
        console.log('SW: Cached', asset);
      } catch (err) {
        console.warn('SW: Failed to cache', asset);
      }
    }
  } catch (error) {
    console.error('SW: Asset caching failed:', error);
  }
}

// Install event
self.addEventListener('install', (event) => {
  console.log('SW: Installing');
  event.waitUntil(
    cacheEssentialAssets().then(() => {
      console.log('SW: Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('SW: Activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - VERY selective caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // NEVER cache API requests - let them go directly to network
  if (API_PATTERNS.some(pattern => pattern.test(request.url))) {
    console.log('SW: API request - bypassing cache:', request.url);
    return; // Let the browser handle it normally
  }
  
  // Only handle GET requests from same origin
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }
  
  // Handle app shell (navigation requests)
  if (request.mode === 'navigate' || url.pathname === '/') {
    event.respondWith(handleAppShell(request));
    return;
  }
  
  // Handle static assets
  if (url.pathname.startsWith('/assets/') || 
      url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$/)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }
  
  // Everything else - just fetch from network
});

// Handle app shell - network first with cache fallback
async function handleAppShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('/', response.clone());
    }
    return response;
  } catch (error) {
    console.log('SW: Network failed for app shell, trying cache');
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match('/');
    if (cached) {
      return cached;
    }
    
    // Try static cache as backup
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    const staticCached = await staticCache.match('/');
    return staticCached || new Response('App unavailable offline', { status: 503 });
  }
}

// Handle static assets - cache first
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    return cache.match(request) || new Response('Asset unavailable', { status: 404 });
  }
}

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC' });
        });
      })
    );
  }
});

console.log('SW: Service Worker loaded');
// Enhanced PWA Service Worker with Offline-First Architecture
const BUILD_TIMESTAMP = Date.now();
const CACHE_NAME = `pdf-navigator-v${BUILD_TIMESTAMP}`;
const STATIC_CACHE_NAME = `pdf-navigator-static-v${BUILD_TIMESTAMP}`;
const COVERS_CACHE_NAME = `covers-v${BUILD_TIMESTAMP}`;
const METADATA_CACHE_NAME = `metadata-v${BUILD_TIMESTAMP}`;

// Cache configurations
const CACHE_CONFIG = {
  STATIC_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  COVERS_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  METADATA_MAX_AGE: 5 * 60 * 1000, // 5 minutes
  MAX_COVERS_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_METADATA_SIZE: 10 * 1024 * 1024 // 10MB
};

// Essential files for offline functionality
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - cache essential assets and set up storage
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing enhanced offline version', BUILD_TIMESTAMP);
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache the app shell
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Service Worker: Caching app shell');
        return fetch('/').then((response) => {
          return cache.put('/', response);
        });
      }),
      // Initialize specialized caches
      caches.open(COVERS_CACHE_NAME),
      caches.open(METADATA_CACHE_NAME)
    ]).then(() => {
      console.log('Service Worker: Enhanced installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches and notify clients of update
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating with version', BUILD_TIMESTAMP);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      // Ensure the service worker takes control of all pages immediately
      return self.clients.claim();
    }).then(() => {
      // Notify all clients that a new version is available
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATE_AVAILABLE',
            version: BUILD_TIMESTAMP
          });
        });
      });
    })
  );
});

// Enhanced fetch handler with intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests except Supabase
  if (url.origin !== location.origin && !url.hostname.includes('supabase.co')) {
    return;
  }

  // Handle Supabase storage requests (covers)
  if (url.hostname.includes('supabase.co') && url.pathname.includes('/storage/')) {
    event.respondWith(handleStorageRequest(request));
    return;
  }

  // Handle different types of requests based on path
  if (url.pathname === '/') {
    // App shell - Cache first with network update
    event.respondWith(handleAppShell(request));
  } else if (url.pathname.startsWith('/assets/')) {
    // Static assets - Cache first
    event.respondWith(handleStaticAssets(request));
  } else if (url.pathname.startsWith('/audio/') || url.pathname.startsWith('/pdfs/') || url.pathname.startsWith('/video/')) {
    // Large files - Network only (no offline support)
    event.respondWith(handleLargeFiles(request));
  } else if (url.pathname.startsWith('/data/')) {
    // Metadata files - Stale while revalidate
    event.respondWith(handleMetadata(request));
  } else {
    // All other requests - Network first with fallback
    event.respondWith(handleGenericRequest(request));
  }
});

// App shell handler - Cache first with background update
async function handleAppShell(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      // Return cached immediately, update in background
      fetchAndCache(request, CACHE_NAME);
      return cached;
    }
    
    // No cache, fetch from network
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Try to serve cached version as last resort
    const cache = await caches.open(CACHE_NAME);
    return cache.match(request) || new Response('App unavailable offline', { status: 503 });
  }
}

// Static assets handler - Cache first
async function handleStaticAssets(request) {
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
    return cache.match(request) || new Response('Asset not available', { status: 404 });
  }
}

// Storage handler for cover images - Stale while revalidate
async function handleStorageRequest(request) {
  try {
    const cache = await caches.open(COVERS_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      // Check if cached response is stale
      const cacheTime = cached.headers.get('sw-cache-time');
      const isStale = !cacheTime || (Date.now() - parseInt(cacheTime)) > CACHE_CONFIG.COVERS_MAX_AGE;
      
      if (!isStale) {
        return cached;
      }
      
      // Return stale content immediately, update in background
      fetchAndCacheStorage(request);
      return cached;
    }
    
    // No cache, fetch from network
    return await fetchAndCacheStorage(request);
  } catch (error) {
    const cache = await caches.open(COVERS_CACHE_NAME);
    return cache.match(request) || new Response('Image not available offline', { status: 404 });
  }
}

// Metadata handler - Stale while revalidate
async function handleMetadata(request) {
  try {
    const cache = await caches.open(METADATA_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      const cacheTime = cached.headers.get('sw-cache-time');
      const isStale = !cacheTime || (Date.now() - parseInt(cacheTime)) > CACHE_CONFIG.METADATA_MAX_AGE;
      
      if (!isStale) {
        return cached;
      }
      
      // Return stale, update in background
      fetchAndCacheMetadata(request);
      return cached;
    }
    
    return await fetchAndCacheMetadata(request);
  } catch (error) {
    const cache = await caches.open(METADATA_CACHE_NAME);
    return cache.match(request) || new Response('Metadata not available offline', { status: 404 });
  }
}

// Large files handler - Network only
async function handleLargeFiles(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response('Content requires network connection', { status: 503 });
  }
}

// Generic handler - Network first with cache fallback
async function handleGenericRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    return cache.match(request) || new Response('Content not available offline', { status: 503 });
  }
}

// Helper functions for background caching
async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
  } catch (error) {
    console.log('Background fetch failed:', error);
  }
}

async function fetchAndCacheStorage(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(COVERS_CACHE_NAME);
    const responseWithTime = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...response.headers,
        'sw-cache-time': Date.now().toString()
      }
    });
    cache.put(request, responseWithTime.clone());
    return responseWithTime;
  }
  return response;
}

async function fetchAndCacheMetadata(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(METADATA_CACHE_NAME);
    const responseWithTime = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...response.headers,
        'sw-cache-time': Date.now().toString()
      }
    });
    cache.put(request, responseWithTime.clone());
    return responseWithTime;
  }
  return response;
}

// Enhanced background sync with cache management
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered for tag:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      Promise.all([
        performBackgroundSync(),
        cleanupCaches(),
        preloadCriticalContent()
      ])
    );
  }
});

// Background sync implementation
async function performBackgroundSync() {
  try {
    // Notify main thread to process sync queue
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'BACKGROUND_SYNC' });
    });
    
    console.log('Service Worker: Background sync notification sent');
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

// Cache cleanup to manage storage usage
async function cleanupCaches() {
  try {
    const coversCacheName = COVERS_CACHE_NAME;
    const coversCache = await caches.open(coversCacheName);
    
    // Get all cached responses and sort by access time
    const requests = await coversCache.keys();
    const cacheEntries = await Promise.all(
      requests.map(async (request) => {
        const response = await coversCache.match(request);
        const cacheTime = response?.headers.get('sw-cache-time') || '0';
        return { request, cacheTime: parseInt(cacheTime) };
      })
    );
    
    // Sort by cache time (oldest first)
    cacheEntries.sort((a, b) => a.cacheTime - b.cacheTime);
    
    // Remove oldest entries if we have too many
    const maxEntries = 100; // Limit number of cached covers
    if (cacheEntries.length > maxEntries) {
      const toRemove = cacheEntries.slice(0, cacheEntries.length - maxEntries);
      await Promise.all(
        toRemove.map(entry => coversCache.delete(entry.request))
      );
      console.log(`Service Worker: Cleaned up ${toRemove.length} old cover cache entries`);
    }
  } catch (error) {
    console.error('Service Worker: Cache cleanup failed:', error);
  }
}

// Preload critical content when online
async function preloadCriticalContent() {
  try {
    // This could be enhanced to preload frequently accessed covers
    console.log('Service Worker: Preloading critical content');
  } catch (error) {
    console.error('Service Worker: Preload failed:', error);
  }
}

// Handle push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New content available',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192x192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('PDF Navigator', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: BUILD_TIMESTAMP });
  }
});
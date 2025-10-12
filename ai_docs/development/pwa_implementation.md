# PWA (Progressive Web App) Implementation

## Overview

The application is now a Progressive Web App (PWA), allowing users to install it on Android/iOS devices and use it as a standalone app with offline capabilities.

**Status:** ✅ Fully Implemented (January 2025)

---

## Features

### Installability

**Platforms:**
- ✅ Android - Install via Chrome "Add to Home Screen"
- ✅ iOS - Install via Safari "Add to Home Screen"
- ✅ Desktop - Install via Chrome/Edge "Install App" prompt

**User Experience:**
- App opens in standalone window (no browser UI)
- Splash screen with app icon and theme color
- Appears in app drawer/launcher alongside native apps

---

### Offline Support

**Cache Strategy:** Network-first with cache fallback

**What's Cached:**
- HTML pages
- CSS stylesheets (including Tailwind builds)
- JavaScript files (Stimulus controllers, ActionCable)
- Images (logos, avatars, lesson images)
- Fonts

**Cache Versioning:** `v1` (increment on breaking changes)

---

### Theme Customization

**Primary Color:** `#dc2626` (red-600)
**Background:** `#ffffff` (white)

**iOS-Specific:**
- Status bar style: black-translucent
- Apple touch icon: 180×180px
- Splash screen background: white

---

## Implementation

### Routes Configuration

**File:** `config/routes.rb` (Lines 20-21)

```ruby
# PWA Routes
get "manifest", to: "pwa#manifest", as: :pwa_manifest
get "service-worker", to: "pwa#service_worker", as: :pwa_service_worker
```

**Endpoints:**
- `/manifest.json` - Web App Manifest (app metadata)
- `/service-worker.js` - Service Worker (caching logic)

---

### Web App Manifest

**File:** `app/views/pwa/manifest.json.erb`

```json
{
  "name": "Курсы по Доставке Еды на Бали",
  "short_name": "DBC Bali",
  "description": "Полный курс по работе с GoFood и GrabFood на Бали",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#dc2626",
  "orientation": "portrait-primary",
  "lang": "ru",
  "icons": [
    {
      "src": "<%= asset_path('icon-192.png') %>",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "<%= asset_path('icon-512.png') %>",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Fields:**
- `name` - Full app name (shown on splash screen)
- `short_name` - Short name (shown under icon)
- `start_url` - URL to open when app launches
- `display: standalone` - Opens without browser UI
- `theme_color` - Browser UI color (Android status bar)
- `icons` - App icons (192×192 for launcher, 512×512 for splash)

**Icon Requirements:**
- 192×192px - Minimum size for Android launcher
- 512×512px - Minimum size for splash screen
- Purpose: `any maskable` - Works with adaptive icons on Android

---

### Service Worker

**File:** `app/views/pwa/service-worker.js`

**Cache Strategy:**

```javascript
const CACHE_NAME = 'dbcours-v1';
const URLS_TO_CACHE = [
  '/',
  '/freecontent',
  '/assets/tailwind.css',
  '/assets/application.js',
  // ... other assets
];

// Install: Cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Activate new SW immediately
});

// Fetch: Network-first, cache fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response before caching
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Network failed, return cached version
        return caches.match(event.request);
      })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim(); // Take control of all pages immediately
});
```

**Lifecycle:**

1. **Install** - Downloads and caches static assets
2. **Activate** - Deletes old caches, takes control
3. **Fetch** - Intercepts network requests
   - Try network first (fresh content)
   - If network fails, serve from cache (offline support)
   - Update cache with fresh response

**Benefits:**
- Users always get latest content (network-first)
- Works offline with cached content
- Automatic cache updates on successful fetches

---

### Service Worker Registration

**File:** `app/javascript/application.js` (Lines 1-21)

```javascript
// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('ServiceWorker registered:', registration.scope);

        // Check for updates every 24 hours
        setInterval(() => {
          registration.update();
        }, 24 * 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error('ServiceWorker registration failed:', error);
      });
  });
}
```

**Features:**
- Registers SW after page load (non-blocking)
- Checks for updates every 24 hours
- Logs registration status to console

---

### HTML Meta Tags

**File:** `app/views/layouts/application.html.erb` (Lines 7-15)

```html
<!-- PWA Manifest -->
<link rel="manifest" href="<%= pwa_manifest_path(format: :json) %>">

<!-- iOS-specific meta tags -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="DBC Bali">
<link rel="apple-touch-icon" href="<%= asset_path('icon-180.png') %>">

<!-- Theme color for browser UI -->
<meta name="theme-color" content="#dc2626">
```

**iOS Tags:**
- `apple-mobile-web-app-capable` - Enables standalone mode on iOS
- `apple-mobile-web-app-status-bar-style` - iOS status bar appearance
- `apple-touch-icon` - Icon used on iOS home screen (180×180px)

**Theme Color:**
- Shows red (#dc2626) in Android Chrome browser UI
- Matches app theme color from manifest

---

## Asset Requirements

### Icons

**Location:** `app/assets/images/`

**Required Files:**
- `icon-192.png` - 192×192px (Android launcher)
- `icon-512.png` - 512×512px (Android splash screen)
- `icon-180.png` - 180×180px (iOS home screen)

**Design Guidelines:**
- Use solid background (no transparency for maskable icons)
- Center logo with 10% padding (safe zone for Android adaptive icons)
- Export as PNG with sRGB color profile

**Example Generation:**
```bash
# Using ImageMagick
convert logo.png -resize 192x192 icon-192.png
convert logo.png -resize 512x512 icon-512.png
convert logo.png -resize 180x180 icon-180.png
```

---

## User Installation Flow

### Android (Chrome)

**Steps:**
1. User visits site in Chrome
2. Chrome shows "Add to Home Screen" banner (after engagement signals)
3. User taps "Add" → Icon appears on home screen
4. Tap icon → App opens in standalone window (no browser UI)

**Criteria for Install Prompt:**
- Site served over HTTPS
- Has valid manifest.json
- Has registered service worker
- User has visited at least twice (5 minutes apart)

---

### iOS (Safari)

**Steps:**
1. User opens site in Safari
2. Tap Share button (bottom center)
3. Scroll down, tap "Add to Home Screen"
4. Enter app name (pre-filled from manifest)
5. Tap "Add" → Icon appears on home screen
6. Tap icon → App opens (minimal Safari UI)

**Note:** iOS doesn't show automatic install prompt (manual only)

---

### Desktop (Chrome/Edge)

**Steps:**
1. User visits site in Chrome/Edge
2. Install icon appears in address bar (right side)
3. Click install icon → Install prompt appears
4. Click "Install" → App opens in dedicated window
5. App appears in Start Menu/Applications folder

---

## Testing

### Development Testing

**1. Check Manifest:**
```bash
# Visit in browser
open http://localhost:3000/manifest.json

# Expected: Valid JSON with app metadata
```

**2. Check Service Worker:**
```bash
# Visit in browser
open http://localhost:3000/service-worker.js

# Expected: JavaScript with cache logic
```

**3. Chrome DevTools:**
```
1. Open DevTools (F12)
2. Application tab → Manifest
   - Check icon, name, colors
3. Application tab → Service Workers
   - Check registration status
4. Application tab → Cache Storage
   - Check cached files after page load
```

---

### Android Testing

**Using Chrome DevTools Remote Debugging:**

```bash
# 1. Enable USB debugging on Android device
# 2. Connect device via USB
# 3. Open chrome://inspect on desktop Chrome
# 4. Select device → Open DevTools
# 5. Check Application tab (same as desktop)
```

**Lighthouse PWA Audit:**
```bash
# DevTools → Lighthouse tab
# Select "Progressive Web App"
# Run audit

# Expected: 100/100 score
```

---

### iOS Testing

**Safari Web Inspector:**
```bash
# 1. Enable Web Inspector on iOS (Settings → Safari → Advanced)
# 2. Connect device via USB
# 3. Safari → Develop → [Device] → [Page]
# 4. Inspect Service Worker registration
```

**Manual Install Test:**
```
1. Open site in Safari
2. Share → Add to Home Screen
3. Launch app from home screen
4. Check standalone mode (no Safari UI)
```

---

## Debugging

### Service Worker Not Registering

**Check Console:**
```javascript
navigator.serviceWorker.register('/service-worker.js')
  .catch((error) => {
    console.error('SW registration failed:', error);
  });
```

**Common Issues:**
- Not served over HTTPS (required in production)
- Service worker file has syntax error
- MIME type incorrect (must be `application/javascript`)

**Solution:**
```ruby
# config/initializers/mime_types.rb
Mime::Type.register "application/javascript", :js
```

---

### Icons Not Appearing

**Check Asset Pipeline:**
```bash
# Development
ls app/assets/images/icon-*.png

# Production (after deploy)
bin/kamal app exec 'ls public/assets/icon-*.png'
```

**Check Manifest URLs:**
```bash
# Visit manifest, check icon URLs
curl https://your-domain.com/manifest.json | jq .icons
```

**Solution:**
- Ensure icons exist in `app/assets/images/`
- Run `bin/rails assets:precompile` before deploy
- Check asset_path helpers in manifest.json.erb

---

### Cache Not Working Offline

**Test Offline Mode:**
```
1. Open DevTools → Network tab
2. Check "Offline" checkbox
3. Reload page
4. Expected: Page loads from cache (no network errors)
```

**Check Service Worker Status:**
```javascript
// Console
navigator.serviceWorker.controller
// Should return ServiceWorker object if active
```

**Force Update Service Worker:**
```
DevTools → Application → Service Workers → Unregister
Reload page → SW re-registers with fresh cache
```

---

## Performance Considerations

### Cache Size

**Current Cache:**
- HTML pages: ~50KB each
- Tailwind CSS: ~200KB (compressed)
- JavaScript: ~100KB (compressed)
- Icons: ~30KB total

**Total:** ~500KB-1MB cached

**Limit:** Browser storage quota (usually 50MB+)

---

### Cache Invalidation

**Version Bump:**
```javascript
// service-worker.js
const CACHE_NAME = 'dbcours-v2'; // Increment version

// Old cache (v1) automatically deleted on activate
```

**When to Bump:**
- Major app redesign
- Breaking changes to cached assets
- Critical bug fixes in offline content

---

### Network-First vs Cache-First

**Current Strategy:** Network-first

**Pros:**
- Users always get latest content
- Cache only used when offline

**Cons:**
- Requires network request (slight delay)
- More data usage

**Alternative (Cache-First):**
```javascript
event.respondWith(
  caches.match(event.request).then((cached) => {
    return cached || fetch(event.request);
  })
);
```

**When to Use:**
- Static content that rarely changes
- Better offline-first experience
- Reduce network requests

---

## Security

### HTTPS Requirement

**Service Workers only work over HTTPS** (except localhost)

**Why:**
- SW can intercept all network requests
- MITM attack risk if not encrypted
- Browser security policy

**Setup:**
```yaml
# config/deploy.yml (Kamal)
proxy:
  ssl: true
  host: your-domain.com
  acme:
    email: your-email@example.com
```

Kamal automatically provisions Let's Encrypt SSL certificate.

---

### Content Security Policy (CSP)

**Considerations:**
```html
<!-- Allow service worker to load -->
<meta http-equiv="Content-Security-Policy"
      content="worker-src 'self'">
```

**Current:** No strict CSP (may add in future)

---

## Analytics

### Track PWA Installs

**JavaScript:**
```javascript
window.addEventListener('beforeinstallprompt', (e) => {
  // User can install
  console.log('Install prompt available');

  // Track with analytics
  gtag('event', 'pwa_install_available');
});

window.addEventListener('appinstalled', (e) => {
  // User installed
  console.log('PWA installed');

  // Track with analytics
  gtag('event', 'pwa_installed');
});
```

---

### Detect Standalone Mode

**Check if opened as installed app:**
```javascript
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('Running as installed PWA');

  // Track with analytics
  gtag('event', 'pwa_opened_standalone');
}
```

---

## Future Enhancements

### Push Notifications

**Workflow:**
1. User installs PWA → Ask for notification permission
2. Server sends push notification (via Web Push API)
3. Service Worker receives notification → Shows browser notification
4. User clicks notification → Opens app to relevant page

**Use Cases:**
- New lesson available
- Course purchase confirmation
- Live workshop reminder

**Implementation:**
```javascript
// service-worker.js
self.addEventListener('push', (event) => {
  const data = event.data.json();

  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: { url: data.url }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

---

### Background Sync

**Use Case:** Send messages even when offline

**Workflow:**
1. User sends message while offline
2. Message queued in IndexedDB
3. Service Worker syncs when connection restored
4. Message sent to server

**Implementation:**
```javascript
// Register sync
navigator.serviceWorker.ready.then((registration) => {
  registration.sync.register('sync-messages');
});

// service-worker.js
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessagesFromIndexedDB());
  }
});
```

---

### Offline Page

**Current:** Shows cached version if available

**Enhancement:** Custom offline page

```javascript
// service-worker.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request)
          .catch(() => {
            // No cached version, show offline page
            return caches.match('/offline.html');
          });
      })
  );
});
```

---

## Related Documentation

- **Frontend Architecture**: `/ai_docs/development/frontend_architecture.md`
- **Deployment**: `/ai_docs/development/deployment.md`
- **Design System**: `/ai_docs/ui/design_system.md`

---

## References

### Specifications

- [W3C Web App Manifest](https://www.w3.org/TR/appmanifest/)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Google PWA Checklist](https://web.dev/pwa-checklist/)

### Tools

- [Lighthouse PWA Audit](https://developers.google.com/web/tools/lighthouse)
- [PWA Builder](https://www.pwabuilder.com/) - Manifest generator
- [Workbox](https://developers.google.com/web/tools/workbox) - Advanced SW library (not used currently)

---

## Conclusion

The PWA implementation transforms the web application into an installable app with offline support, providing a native-like experience on Android, iOS, and desktop. The network-first caching strategy ensures users always get fresh content while maintaining offline functionality. Future enhancements like push notifications and background sync can further improve user engagement.

**Status:** Production-ready ✅
**Maintenance:** Update cache version when releasing breaking changes

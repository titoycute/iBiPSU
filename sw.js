// This is a basic service worker file.
// It's required for the "Add to Home Screen" prompt to appear.

self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
});

self.addEventListener('fetch', (event) => {
  // This service worker doesn't do any caching yet,
  // but it's ready for when you want to add offline capabilities.
  event.respondWith(fetch(event.request));
});
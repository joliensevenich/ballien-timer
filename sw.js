// Bewaart de app op het toestel, zodat hij ook zonder internet werkt.
// Verhoog VERSION bij elke nieuwe versie: dan haalt de app de nieuwe bestanden op.
const VERSION = 'timer-v8';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'js/core.js',
  'js/report.js',
  'js/app.js',
  'logo.png',
  'logo_excel.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/jspdf.umd.min.js',
  'vendor/tesseract/tesseract.min.js',
  'vendor/tesseract/worker.min.js',
  'vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract/tesseract-core-lstm.wasm.js',
  'vendor/tesseract/lang/eng.traineddata.gz',
  'vendor/tesseract/lang/nld.traineddata.gz',
];

self.addEventListener('install', event => {
  // 'reload': altijd de nieuwste bestanden van de server, niet uit de tussenopslag van de browser.
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// De app vraagt een klaarstaande nieuwe versie om meteen actief te worden.
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Eerst uit de opgeslagen kopie; wat er nog niet in staat, van het internet.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(hit => hit || fetch(event.request).catch(() =>
      event.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))
  );
});

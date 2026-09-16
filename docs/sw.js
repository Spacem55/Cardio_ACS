// Service worker — офлайн-кеш для PWA (доступ с iPhone через "На экран «Домой»").
// Версия кеша бампается при каждой пересборке "с нуля" (v2 -> v3), чтобы Safari
// на iPhone не отдавал старые файлы из предыдущей версии сайта.
const CACHE_NAME = 'cardio-acs-v3';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'calculators.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/sex/ic_sex_male_active.png',
  'icons/sex/ic_sex_male_inactive.png',
  'icons/sex/ic_sex_female_active.png',
  'icons/sex/ic_sex_female_inactive.png',
  'icons/sex/ic_sex_male_active_dark.png',
  'icons/sex/ic_sex_male_inactive_dark.png',
  'icons/sex/ic_sex_female_active_dark.png',
  'icons/sex/ic_sex_female_inactive_dark.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

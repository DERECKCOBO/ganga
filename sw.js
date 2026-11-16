'use strict';
/* Ganga v1 — service worker mínimo: guarda el cascarón para abrir offline.
   deals.json siempre va a la red primero: una oferta vieja cacheada es peor que ninguna. */
var CACHE = 'ganga-v2';
var SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.pathname.endsWith('deals.json')) {
    e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); }));
});

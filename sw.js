/* Bored Bandit service worker: makes the site installable and keeps it usable on a weak connection. */
var VERSION = 'ec-v10';
var SHELL = [
  './', 'index.html', 'submit.html', 'contact.html', 'styles.css?v=24', 'app.js?v=20', 'submit.js?v=11', 'contact.js?v=1', 'install.js?v=4',
  'data/tx-zips.json', 'data/tx-cities.json?v=2', 'favicon.png', 'icons/icon-192.png?v=2', 'logo.webp?v=2', 'manifest.webmanifest'
];
var SHEET_KEY = 'https://boredbandit.nedwebservices.com/__last-sheet.csv';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // The events sheet: always try the network for fresh events; fall back to the last copy if offline.
  if (url.hostname === 'docs.google.com' && url.pathname.indexOf('/pub') > -1) {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(SHEET_KEY, copy); }); }
      return res;
    }).catch(function () { return caches.match(SHEET_KEY); }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Pages: network first so updates show right away; cached copy if offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (r) { return r || caches.match('./'); });
    }));
    return;
  }

  // Files: serve from cache, refresh in the background.
  e.respondWith(caches.match(req).then(function (cached) {
    var fresh = fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return cached; });
    return cached || fresh;
  }));
});

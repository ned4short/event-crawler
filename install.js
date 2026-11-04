/* Event Crawler app banner: offers to install the app (or open it, if installed) in the red strip
   at the top of the page. Shown only when it's actually possible, and the X hides it for 30 days. */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }

  var bar = document.getElementById('app-bar');
  if (!bar) return;
  var text = document.getElementById('app-bar-text');
  var action = document.getElementById('app-bar-action');
  var close = document.getElementById('app-bar-close');

  var DISMISS_KEY = 'ec_app_bar_closed';
  var INSTALLED_KEY = 'ec_app_installed';
  var DAYS = 30;

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // Already running as the installed app: never show the banner.
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (standalone) { store(INSTALLED_KEY, '1'); return; }

  var closedAt = parseInt(read(DISMISS_KEY) || '0', 10);
  var recentlyClosed = closedAt && (Date.now() - closedAt) < DAYS * 864e5;

  var deferred = null;
  var mode = null;

  function show(m, message, label) {
    if (recentlyClosed) return;
    mode = m;
    text.textContent = message;
    if (label) { action.textContent = label; action.hidden = false; } else { action.hidden = true; }
    bar.hidden = false;
  }
  function hide() { bar.hidden = true; }

  close.addEventListener('click', function () {
    store(DISMISS_KEY, String(Date.now()));
    hide();
  });

  action.addEventListener('click', function () {
    if (mode === 'install' && deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') { store(INSTALLED_KEY, '1'); hide(); }
        deferred = null;
      });
    } else if (mode === 'open') {
      // Browsers that support it open the installed app; others simply reload the page.
      window.open('/?source=app', '_blank', 'noopener');
    }
  });

  // Chrome, Edge, Samsung Internet and other Chromium browsers (Android, Windows, Mac, Chromebook, Linux).
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    store(INSTALLED_KEY, null);
    show('install', 'Get the Event Crawler app: one tap to today’s events, no app store needed.', 'Install');
  });

  window.addEventListener('appinstalled', function () {
    store(INSTALLED_KEY, '1');
    deferred = null;
    hide();
  });

  function offerOpen() {
    show('open', 'You have the Event Crawler app.', 'Open app');
  }

  // Already installed? (Chromium browsers can tell us; otherwise we remember a past install.)
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(function (apps) {
      if (apps && apps.length && !deferred) offerOpen();
    }).catch(function () {});
  } else if (read(INSTALLED_KEY) === '1') {
    offerOpen();
  }

  // iPhone and iPad have no install button, so explain the two taps instead.
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && read(INSTALLED_KEY) !== '1') {
    show('ios', 'Add Event Crawler to your Home Screen: tap Share, then “Add to Home Screen”.', null);
  }
})();

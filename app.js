(function () {
  'use strict';

  var TZ = 'America/Chicago';
  var DOWNTOWN = { lat: 29.4241, lng: -98.4936, label: 'downtown San Antonio' };
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  var state = {
    when: 'today', picked: '', radius: 20, query: '',
    origin: DOWNTOWN
  };
  var events = [];
  var zips = null;

  var $ = function (id) { return document.getElementById(id); };

  // ---------- dates (always San Antonio time) ----------
  function todayIso() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    var get = function (t) { return parts.filter(function (p) { return p.type === t; })[0].value; };
    return get('year') + '-' + get('month') + '-' + get('day');
  }
  function toDate(iso) { var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function toIso(d) { return d.toISOString().slice(0, 10); }
  function addDays(iso, n) { var d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); }
  function longDate(iso) { var d = toDate(iso); return DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
  function shortDate(iso) { var d = toDate(iso); return DAYS[d.getUTCDay()].slice(0, 3) + ', ' + MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCDate(); }

  function dateRange() {
    var t = todayIso();
    if (state.when === 'tomorrow') { var tm = addDays(t, 1); return { from: tm, to: tm, title: 'Tomorrow · ' + longDate(tm) }; }
    if (state.when === 'weekend') {
      var dow = toDate(t).getUTCDay();
      var sat = dow === 6 ? t : dow === 0 ? addDays(t, -1) : addDays(t, 6 - dow);
      var from = dow === 0 ? t : sat, to = addDays(sat, 1);
      return { from: from, to: to, title: 'This weekend · ' + shortDate(sat) + ' – ' + shortDate(to), multi: true };
    }
    if (state.when === 'week') {
      var dw = toDate(t).getUTCDay();
      var sun = dw === 0 ? t : addDays(t, 7 - dw);
      return { from: t, to: sun, title: 'This week · ' + shortDate(t) + ' – ' + shortDate(sun), multi: true };
    }
    if (state.when === 'month') {
      var d = toDate(t);
      var last = toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
      return { from: t, to: last, title: 'This month · ' + shortDate(t) + ' – ' + shortDate(last), multi: true };
    }
    if (state.when === 'nextmonth') {
      var n = toDate(t);
      var first = toIso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1)));
      var end = toIso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 2, 0)));
      return { from: first, to: end, title: 'Next month · ' + MONTHS[toDate(first).getUTCMonth()] + ' ' + toDate(first).getUTCFullYear(), multi: true };
    }
    if (state.when === 'pick' && state.picked) { return { from: state.picked, to: state.picked, title: longDate(state.picked) }; }
    return { from: t, to: t, title: 'Today · ' + longDate(t) };
  }

  // ---------- time and distance ----------
  function minutes(time) {
    var m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec((time || '').trim());
    if (!m) return 24 * 60;
    var h = parseInt(m[1], 10) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
    return h * 60 + parseInt(m[2], 10);
  }
  function miles(a, b) {
    var R = 3958.8, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function isFree(p) { return /^free\b/i.test((p || '').trim()); }

  // ---------- render ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render() {
    renderStarred();
    var range = dateRange();
    var q = state.query.trim().toLowerCase();
    var list = events.filter(function (e) {
      if (e.date < range.from || e.date > range.to) return false;
      if (q && (e.name + ' ' + e.venue + ' ' + e.city).toLowerCase().indexOf(q) === -1) return false;
      e._mi = (e.lat != null) ? miles(state.origin, e) : null;
      if (e._mi != null && e._mi > state.radius) return false;
      return true;
    }).sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : minutes(a.time) - minutes(b.time);
    });

    $('heading').textContent = range.title;
    var n = list.length;
    $('summary').textContent = n + (n === 1 ? ' event' : ' events') + ' within ' + state.radius + (state.radius === 1 ? ' mile' : ' miles') + ' of ' + state.origin.label;

    var box = $('list');
    box.textContent = '';
    if (!n) {
      var empty = el('div', 'empty');
      empty.innerHTML = '<svg width="56" height="56" viewBox="0 0 44 44" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#D62839"/><rect x="24" y="2" width="18" height="18" rx="2" fill="#1F4FBF"/><path d="M2 42 L22 24 L22 42 Z" fill="#FFC93C"/></svg>';
      empty.appendChild(el('p', 'big', 'No events found yet'));
      empty.appendChild(el('p', 'muted', 'Our crawler adds new events every day. Try another date, a wider distance, or clear your search.'));
      box.appendChild(empty);
      return;
    }

    var groups = [];
    list.forEach(function (e) {
      var key, label, dot;
      if (range.multi) { key = e.date; label = longDate(e.date); dot = 'afternoon'; }
      else {
        var m = minutes(e.time);
        if (m < 12 * 60) { key = 'm'; label = 'Morning'; dot = 'morning'; }
        else if (m < 17 * 60) { key = 'a'; label = 'Afternoon'; dot = 'afternoon'; }
        else { key = 'e'; label = 'Evening'; dot = 'evening'; }
      }
      var g = groups[groups.length - 1];
      if (!g || g.key !== key) { g = { key: key, label: label, dot: dot, items: [] }; groups.push(g); }
      g.items.push(e);
    });

    // On long lists (more than 25 events), show the Ned Ads slideshow after the 15th event,
    // then after every 15 more (30, 45, 60...), but never within the last 10 events.
    var AD_FIRST = 15, AD_EVERY = 15, AD_MIN_LIST = 25, AD_END_GAP = 10;
    var shown = 0, adNo = 0, total = list.length;
    groups.forEach(function (g) {
      var sec = el('section', 'group');
      var h = el('h3');
      h.appendChild(el('span', 'dot ' + g.dot));
      h.appendChild(document.createTextNode(g.label));
      sec.appendChild(h);
      g.items.forEach(function (e) {
        sec.appendChild(card(e));
        shown++;
        if (total > AD_MIN_LIST && shown >= AD_FIRST && (shown - AD_FIRST) % AD_EVERY === 0 && total - shown >= AD_END_GAP) {
          adNo++;
          var ad = el('div', 'inline-ads');
          ad.setAttribute('data-ned-ads', '');
          ad.setAttribute('data-start', String(adNo));
          sec.appendChild(ad);
        }
      });
      box.appendChild(sec);
    });
  }

  // ---------- starred events (saved on this device) ----------
  var STAR_KEY = 'ec_starred_v1';
  var STAR_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L2.9 9.4l6.3-.9z"/></svg>';
  var STAR_FIELDS = ['date', 'time', 'name', 'venue', 'address', 'city', 'state', 'zip', 'organizer', 'price', 'link', 'lat', 'lng'];

  function starKey(e) { return e.date + '|' + e.time + '|' + (e.name || '').toLowerCase(); }
  function loadStars() {
    try { return JSON.parse(localStorage.getItem(STAR_KEY) || '{}') || {}; } catch (x) { return {}; }
  }
  function saveStars(st) { try { localStorage.setItem(STAR_KEY, JSON.stringify(st)); } catch (x) {} }
  var stars = loadStars();

  function starButton(e) {
    var key = starKey(e);
    var b = el('button', 'star-btn');
    b.type = 'button';
    b.setAttribute('data-star', key);
    b.innerHTML = STAR_SVG;
    setStarState(b, !!stars[key], e.name);
    b.addEventListener('click', function () { toggleStar(e, b); });
    return b;
  }
  function setStarState(b, on, name) {
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', (on ? 'Remove star from ' : 'Star ') + name);
    b.title = on ? 'Starred: tap to remove' : 'Star this event to find it again later';
  }

  function toggleStar(e, btn) {
    var key = starKey(e);
    var section = $('starred');
    var inSection = section.contains(btn);
    var before = btn.getBoundingClientRect().top;
    var on = !stars[key];
    if (on) {
      var snap = {};
      STAR_FIELDS.forEach(function (f) { if (e[f] != null && e[f] !== '') snap[f] = e[f]; });
      stars[key] = snap;
    } else {
      delete stars[key];
    }
    saveStars(stars);
    Array.prototype.forEach.call(document.querySelectorAll('[data-star]'), function (b) {
      if (b.getAttribute('data-star') === key) setStarState(b, on, e.name);
    });
    renderStarred();
    // Keep the tapped event in the same spot on screen when the starred list above grows or shrinks.
    if (!inSection) {
      var shift = btn.getBoundingClientRect().top - before;
      if (shift) window.scrollBy(0, shift);
    }
    toast(on ? 'Starred. It’ll be waiting at the top of the page.' : 'Removed from your starred events.');
  }

  function renderStarred() {
    var section = $('starred');
    var t = todayIso();
    var byKey = {};
    events.forEach(function (ev) { byKey[starKey(ev)] = ev; });
    var changed = false;
    var list = Object.keys(stars).map(function (k) {
      var s = stars[k];
      if (!s || !s.date || s.date < t) { delete stars[k]; changed = true; return null; }
      return byKey[k] || s;
    }).filter(Boolean);
    if (changed) saveStars(stars);

    section.textContent = '';
    if (!list.length) { section.hidden = true; return; }
    list.forEach(function (e) { e._mi = e.lat != null ? miles(state.origin, e) : null; });
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : minutes(a.time) - minutes(b.time); });

    var head = el('div', 'starred-head');
    var h = el('h2');
    h.id = 'starred-title';
    h.innerHTML = STAR_SVG;
    h.appendChild(document.createTextNode('Your starred events'));
    head.appendChild(h);
    head.appendChild(el('span', 'starred-count', list.length + (list.length === 1 ? ' event' : ' events')));
    section.appendChild(head);

    var lastDate = null;
    list.forEach(function (e) {
      if (e.date !== lastDate) {
        lastDate = e.date;
        var label = e.date === t ? 'Today · ' + longDate(e.date) : e.date === addDays(t, 1) ? 'Tomorrow · ' + longDate(e.date) : longDate(e.date);
        section.appendChild(el('h3', 'starred-day', label));
      }
      section.appendChild(card(e));
    });
    section.hidden = false;
  }

  var toastTimer = null;
  function toast(msg) {
    var n = $('toast');
    n.textContent = msg;
    n.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.classList.remove('show'); }, 2600);
  }

  function card(e) {
    var a = el('article', 'event');
    var t = el('div', 'time');
    var parts = (e.time || '').split(' ');
    t.appendChild(el('b', null, parts[0] || 'TBA'));
    if (parts[1]) t.appendChild(el('small', null, parts[1]));
    a.appendChild(t);

    var info = el('div', 'info');
    info.appendChild(el('h4', null, e.name));
    if (e.venue) info.appendChild(el('p', 'venue', e.venue));
    var ap = el('p', 'addr', [e.address, e.city].filter(Boolean).join(', '));
    if (e.zip) ap.appendChild(el('span', 'zip', ', ' + e.state + ' ' + e.zip));
    if (e.organizer) ap.appendChild(el('span', 'org', ' · Hosted by ' + e.organizer));
    info.appendChild(ap);
    a.appendChild(info);

    var act = el('div', 'actions');
    if (e._mi != null) act.appendChild(el('span', 'dist-tag', (e._mi < 0.1 ? '< 0.1' : e._mi.toFixed(1)) + ' mi'));
    if (e.price) act.appendChild(el('span', 'price' + (isFree(e.price) ? ' free' : ''), e.price));
    if (/^https?:\/\//i.test(e.link || '')) {
      var link = el('a', 'details', 'Details');
      link.href = e.link; link.target = '_blank'; link.rel = 'noopener nofollow';
      link.setAttribute('aria-label', 'Details for ' + e.name);
      link.insertAdjacentHTML('beforeend', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
      act.appendChild(link);
    }
    act.appendChild(starButton(e));
    a.appendChild(act);
    return a;
  }

  // ---------- location ----------
  function note(msg) { $('near-note').textContent = msg || ''; }

  function loadZips() {
    if (zips) return Promise.resolve(zips);
    return fetch('/data/tx-zips.json').then(function (r) { return r.json(); }).then(function (z) { zips = z; return z; });
  }

  var cityTable = null;
  function loadCities() {
    if (cityTable) return Promise.resolve(cityTable);
    return fetch('/data/tx-cities.json?v=2').then(function (r) { return r.json(); }).then(function (c) { cityTable = c; return c; });
  }
  function titleCase(s) { return s.replace(/\b([a-z])/g, function (m) { return m.toUpperCase(); }); }

  // "Near" accepts a 5-digit ZIP code or a Texas city name (e.g. "Helotes" or "New Braunfels, TX").
  function applyZip() {
    var v = $('zip').value.trim();
    if (!v) { state.origin = DOWNTOWN; note(''); return Promise.resolve(); }
    var zip = /^\d{5}(-\d{4})?$/.test(v) ? v.slice(0, 5) : null;
    if (zip) {
      return loadZips().then(function (z) {
        if (z[zip]) { state.origin = { lat: z[zip][0], lng: z[zip][1], label: 'ZIP ' + zip }; note(''); }
        else { note('We couldn’t find ZIP ' + zip + '. Showing events near downtown San Antonio.'); state.origin = DOWNTOWN; }
      }).catch(function () { note('Couldn’t look up that ZIP right now.'); });
    }
    var city = v.toLowerCase().replace(/,?\s*(tx|texas)\.?$/, '').replace(/\s+/g, ' ').trim();
    return loadCities().then(function (c) {
      if (city === 'downtown' || city === 'downtown san antonio') { state.origin = DOWNTOWN; note(''); return; }
      if (c[city]) { state.origin = { lat: c[city][0], lng: c[city][1], label: titleCase(city) }; note(''); }
      else { note('We couldn’t find “' + v + '”. Try a ZIP code or a Texas city name. Showing events near downtown San Antonio.'); state.origin = DOWNTOWN; }
    }).catch(function () { note('Couldn’t look up that place right now.'); });
  }

  // Suggest nearby cities as the visitor types.
  loadCities().then(function (c) {
    var list = document.getElementById('near-cities');
    if (!list) return;
    Object.keys(c).filter(function (k) {
      return miles(DOWNTOWN, { lat: c[k][0], lng: c[k][1] }) <= 60;
    }).sort().forEach(function (k) {
      var o = document.createElement('option');
      o.value = titleCase(k);
      list.appendChild(o);
    });
  }).catch(function () {});

  $('locate').addEventListener('click', function () {
    if (!navigator.geolocation) { note('Your browser can’t share your location. Try a ZIP code or city instead.'); return; }
    note('Finding your location…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' };
      $('zip').value = '';
      note('');
      render();
    }, function () {
      note('We couldn’t get your location. Try a ZIP code or city instead.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });

  // ---------- controls ----------
  $('search').addEventListener('submit', function (ev) {
    ev.preventDefault();
    state.query = $('q').value;
    applyZip().then(render);
    if (window.matchMedia('(max-width: 700px)').matches) $('results').scrollIntoView({ behavior: 'smooth' });
  });
  $('q').addEventListener('input', function () { state.query = this.value; render(); });
  $('zip').addEventListener('change', function () { applyZip().then(render); });

  // The single day being viewed (blank for multi-day ranges).
  function viewedDay() {
    var t = todayIso();
    if (state.when === 'today') return t;
    if (state.when === 'tomorrow') return addDays(t, 1);
    if (state.when === 'pick' && state.picked) return state.picked;
    return '';
  }

  function setWhen(w) {
    state.when = w;
    Array.prototype.forEach.call(document.querySelectorAll('.chip.when'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-when') === w));
    });
    document.querySelector('.date-chip').classList.toggle('on', w === 'pick');
    $('pick').value = viewedDay();
    $('prev-day').disabled = dateRange().from <= todayIso();
    render();
  }

  // Jump to a specific day; Today/Tomorrow light up when they match.
  function goToDay(iso) {
    var t = todayIso();
    if (iso < t) iso = t;
    if (iso === t) { state.picked = ''; setWhen('today'); }
    else if (iso === addDays(t, 1)) { state.picked = ''; setWhen('tomorrow'); }
    else { state.picked = iso; setWhen('pick'); }
  }

  Array.prototype.forEach.call(document.querySelectorAll('.chip.when'), function (b) {
    b.addEventListener('click', function (ev) {
      var w = b.getAttribute('data-when');
      // "Today" opens the home page when clicked from another page.
      if (w === 'today' && location.pathname !== '/' && location.pathname !== '/index.html') return;
      ev.preventDefault();
      state.picked = '';
      setWhen(w);
    });
  });
  $('pick').min = todayIso();
  $('pick').addEventListener('change', function () {
    if (this.value) goToDay(this.value); else goToDay(todayIso());
  });

  function step(n) {
    var day = viewedDay();
    if (!day) { // from a multi-day range: back to the day before it, forward to the day after
      var r = dateRange();
      day = n < 0 ? r.from : r.to;
    }
    goToDay(addDays(day, n));
  }
  $('prev-day').addEventListener('click', function () { step(-1); });
  $('next-day').addEventListener('click', function () { step(1); });
  setWhen(document.body.getAttribute('data-when') || 'today');

  Array.prototype.forEach.call(document.querySelectorAll('.chip.dist'), function (b) {
    b.addEventListener('click', function () {
      state.radius = parseInt(b.getAttribute('data-mi'), 10);
      Array.prototype.forEach.call(document.querySelectorAll('.chip.dist'), function (o) {
        o.setAttribute('aria-pressed', String(o === b));
      });
      render();
    });
  });

  // ---------- data: read straight from the "Event Crawler" Google Sheet ----------
  function parseCsv(text) {
    var rows = [], row = [], field = '', i = 0, q = false, c;
    text = text.replace(/^﻿/, '');
    while (i < text.length) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
      i++;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function normDate(v) {
    v = (v || '').trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(v);
    if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
    return '';
  }

  function normTime(v) {
    v = (v || '').trim().toUpperCase().replace(/\./g, '');
    var m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AP]M)?$/.exec(v);
    if (!m) return v;
    var h = parseInt(m[1], 10), mm = m[2] || '00', ap = m[3];
    if (!ap) { ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
    return h + ':' + mm + ' ' + ap;
  }

  function toEvents(rows, zipTable, cityTable) {
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var idx = function (name) { return head.indexOf(name); };
    var col = {
      date: idx('date'), time: idx('time'), name: idx('event name'), venue: idx('venue name'),
      address: idx('address'), city: idx('city'), state: idx('state'), zip: idx('zip code'),
      organizer: idx('organizer name'), price: idx('price'), link: idx('link'),
      lat: idx('latitude'), lng: idx('longitude')
    };
    var get = function (r, k) { return col[k] > -1 && r[col[k]] ? r[col[k]].trim() : ''; };
    var seen = {}, out = [];
    rows.slice(1).forEach(function (r) {
      var e = {
        date: normDate(get(r, 'date')), time: normTime(get(r, 'time')), name: get(r, 'name'),
        venue: get(r, 'venue'), address: get(r, 'address'), city: get(r, 'city'),
        state: get(r, 'state') || 'TX', zip: get(r, 'zip').slice(0, 5), organizer: get(r, 'organizer'),
        price: get(r, 'price'), link: get(r, 'link')
      };
      if (!e.date || !e.name) return;
      var key = e.date + '|' + e.time + '|' + e.name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      var lat = parseFloat(get(r, 'lat')), lng = parseFloat(get(r, 'lng'));
      if (!isNaN(lat) && !isNaN(lng)) { e.lat = lat; e.lng = lng; }
      else if (zipTable[e.zip]) { e.lat = zipTable[e.zip][0]; e.lng = zipTable[e.zip][1]; }
      else if (cityTable[e.city.toLowerCase()]) { var c = cityTable[e.city.toLowerCase()]; e.lat = c[0]; e.lng = c[1]; }
      out.push(e);
    });
    return out;
  }

  var url = window.EVENT_SHEET_CSV + (window.EVENT_SHEET_CSV.indexOf('?') > -1 ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000);
  Promise.all([
    fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }),
    loadZips(),
    fetch('/data/tx-cities.json?v=2').then(function (r) { return r.json(); })
  ]).then(function (res) {
    events = toEvents(parseCsv(res[0]), res[1], res[2]);
    render();
  }).catch(function () {
    $('summary').textContent = 'Events couldn’t load. Please refresh the page.';
  });
})();

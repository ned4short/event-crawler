(function () {
  'use strict';
  var SECONDS = 5; // time each advertiser image stays up
  var COLORS = {
    red: { bg: '#D62839', fg: '#FFFFFF' },
    blue: { bg: '#1F4FBF', fg: '#FFFFFF' },
    yellow: { bg: '#FFC93C', fg: '#14213D' }
  };
  var COLOR_ORDER = ['blue', 'red', 'yellow'];
  var box = document.querySelector('[data-ads]');
  if (!box) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  fetch('data/advertisers.json', { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (ads) {
      ads = (ads || []).filter(function (a) { return a && a.image && /^https?:\/\//i.test(a.link || ''); });
      if (!ads.length) { box.closest('.ads').hidden = true; return; }
      build(ads);
    })
    .catch(function () { box.closest('.ads').hidden = true; });

  function build(ads) {
    var viewport = document.createElement('div');
    viewport.className = 'ads-viewport';
    var track = document.createElement('div');
    track.className = 'ads-track';
    if (reduce) track.style.transition = 'none';

    ads.forEach(function (a, i) {
      var link = document.createElement('a');
      link.className = 'ad-slide';
      link.href = a.link;
      link.target = '_blank';
      link.rel = 'noopener sponsored';
      link.setAttribute('aria-label', (a.name || 'Advertiser') + ' (opens in a new tab), ad ' + (i + 1) + ' of ' + ads.length);
      var fit = a.fit === 'whole';
      var color = COLORS[a.color] || COLORS[COLOR_ORDER[i % COLOR_ORDER.length]];
      link.className += fit ? ' ad-whole' : ' ad-cover';
      link.style.setProperty('--ad-bg', color.bg);
      link.style.setProperty('--ad-fg', color.fg);
      var img = document.createElement('img');
      img.src = a.image;
      img.alt = a.name || 'Advertiser';
      img.loading = i ? 'lazy' : 'eager';
      link.appendChild(img);
      if (a.showName !== false && a.name) {
        var label = document.createElement('span');
        label.className = 'ad-name';
        label.textContent = a.name;
        if (fit) {
          var panel = document.createElement('span');
          panel.className = 'ad-panel';
          panel.appendChild(label);
          var visit = document.createElement('span');
          visit.className = 'ad-visit';
          visit.textContent = 'Visit ' + a.link.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '') + ' →';
          panel.appendChild(visit);
          link.appendChild(panel);
        } else {
          link.appendChild(label);
        }
      }
      track.appendChild(link);
    });
    viewport.appendChild(track);
    box.appendChild(viewport);

    var current = 0, timer = null, paused = false;
    var controls = document.createElement('div');
    controls.className = 'ads-controls';
    var dots = ads.map(function (a, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'ads-dot';
      d.setAttribute('aria-label', 'Show ad ' + (i + 1) + ': ' + (a.name || 'Advertiser'));
      d.addEventListener('click', function () { go(i); restart(); });
      controls.appendChild(d);
      return d;
    });
    var pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'ads-pause';
    pause.addEventListener('click', function () { paused = !paused; update(); restart(); });
    if (ads.length > 1) { controls.appendChild(pause); box.appendChild(controls); }

    function go(i) {
      current = (i + ads.length) % ads.length;
      track.style.transform = 'translateX(' + (-100 * current) + '%)';
      Array.prototype.forEach.call(track.children, function (s, k) {
        s.tabIndex = k === current ? 0 : -1;
        s.setAttribute('aria-hidden', String(k !== current));
      });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', String(k === current)); });
    }
    function update() {
      pause.textContent = paused ? 'Play' : 'Pause';
      pause.setAttribute('aria-label', paused ? 'Play advertiser slideshow' : 'Pause advertiser slideshow');
    }
    var hover = false;
    function restart() {
      clearInterval(timer);
      if (ads.length > 1 && !paused && !hover) timer = setInterval(function () { go(current + 1); }, SECONDS * 1000);
    }
    viewport.addEventListener('mouseenter', function () { hover = true; restart(); });
    viewport.addEventListener('mouseleave', function () { hover = false; restart(); });
    viewport.addEventListener('focusin', function () { hover = true; restart(); });
    viewport.addEventListener('focusout', function () { hover = false; restart(); });

    var startX = null;
    viewport.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    viewport.addEventListener('touchend', function (e) {
      if (startX == null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) { go(current + (dx < 0 ? 1 : -1)); restart(); }
      startX = null;
    });

    go(0); update(); restart();
  }
})();

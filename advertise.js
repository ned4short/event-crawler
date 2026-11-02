(function () {
  'use strict';
  var form = document.getElementById('ad-form');
  var msg = document.getElementById('ad-msg');
  var btn = document.getElementById('ad-send');
  var $ = function (id) { return document.getElementById(id); };

  if (/[?&]sent=1/.test(location.search)) {
    form.hidden = true;
    $('thanks').hidden = false;
    return;
  }

  function fail(text, field) {
    msg.className = 'form-msg error';
    msg.textContent = text;
    if (field) field.focus();
  }

  form.addEventListener('submit', function (ev) {
    var site = $('ad-site');
    if (site.value.trim() && !/^https?:\/\//i.test(site.value.trim())) site.value = 'https://' + site.value.trim();
    var file = $('ad-image').files[0];

    var bad = null;
    if (!$('ad-name').value.trim()) bad = ['Please enter your name.', $('ad-name')];
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('ad-email').value.trim())) bad = ['Please enter a valid email address.', $('ad-email')];
    else if (!$('ad-business').value.trim()) bad = ['Please enter your business name.', $('ad-business')];
    else { try { new URL(site.value.trim()); } catch (e) { bad = ['Please enter your website link.', site]; } }
    if (!bad && !file) bad = ['Please choose an image to upload.', $('ad-image')];
    if (!bad && !/^image\//.test(file.type)) bad = ['Please upload an image file (JPG, PNG, WebP or GIF).', $('ad-image')];
    if (!bad && file.size > 8 * 1024 * 1024) bad = ['That image is over 8 MB. Please choose a smaller one.', $('ad-image')];
    if (!bad && !$('ad-desc').value.trim()) bad = ['Please add a quick description.', $('ad-desc')];

    if (bad) { ev.preventDefault(); fail(bad[0], bad[1]); return; }
    msg.className = 'form-msg';
    msg.textContent = '';
    btn.disabled = true;
  });
})();

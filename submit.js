(function () {
  'use strict';
  var form = document.getElementById('submit-form');
  var msg = document.getElementById('form-msg');
  var btn = document.getElementById('send');
  var f = {
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    link: document.getElementById('link'),
    website: form.querySelector('[name="website"]')
  };

  function fail(text, field) {
    msg.className = 'form-msg error';
    msg.textContent = text;
    if (field) field.focus();
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = f.name.value.trim();
    var email = f.email.value.trim();
    var link = f.link.value.trim();

    if (!name) return fail('Please enter your name.', f.name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.', f.email);
    if (link && !/^https?:\/\//i.test(link)) { link = 'https://' + link; f.link.value = link; }
    try { new URL(link); } catch (e) { return fail('Please paste the full link to your event.', f.link); }

    if (f.website.value) { done(); return; } // spam bot filled the hidden field

    if (!/^https:\/\/script\.google\.com\//.test(window.SUBMIT_URL || '')) {
      return fail('Submissions aren’t open yet. Please try again soon.');
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    msg.className = 'form-msg';
    msg.textContent = '';

    var body = new URLSearchParams({ name: name, email: email, link: link });
    fetch(window.SUBMIT_URL, { method: 'POST', mode: 'no-cors', body: body })
      .then(done)
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Submit my event';
        fail('Something went wrong. Please check your connection and try again.');
      });
  });

  function done() {
    form.hidden = true;
    var t = document.getElementById('thanks');
    t.hidden = false;
    t.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();

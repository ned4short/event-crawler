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

    btn.disabled = true;
    msg.className = 'form-msg';
    msg.textContent = '';

    fetch(window.SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        'Submitter Name': name,
        'Email': email,
        'Event link': link,
        _subject: 'Event Crawler Event Submission',
        _replyto: email,
        _template: 'table',
        _captcha: 'false'
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && (res.success === true || res.success === 'true')) done();
        else throw new Error((res && res.message) || 'failed');
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Submit my event';
        fail('Something went wrong sending your event. Please try again in a moment.');
      });
  });

  function done() {
    btn.disabled = true;
    btn.textContent = 'Sent';
    [f.name, f.email, f.link].forEach(function (i) { i.readOnly = true; });
    var t = document.getElementById('thanks');
    t.hidden = false;
    t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
})();

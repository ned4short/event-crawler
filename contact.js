(function () {
  'use strict';
  var form = document.getElementById('contact-form');
  var msg = document.getElementById('form-msg');
  var btn = document.getElementById('send');
  var f = {
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    message: document.getElementById('message'),
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
    var phone = f.phone.value.trim();
    var message = f.message.value.trim();

    if (!name) return fail('Please enter your name.', f.name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.', f.email);
    if (phone && (!/^[0-9+().\-\s]+$/.test(phone) || phone.replace(/\D/g, '').length < 7)) return fail('Please check your phone number, or leave it blank.', f.phone);
    if (!message) return fail('Please write a message.', f.message);

    if (f.website.value) { done(); return; } // spam bot filled the hidden field

    btn.disabled = true;
    btn.textContent = 'Sending…';
    msg.className = 'form-msg';
    msg.textContent = '';

    fetch(window.CONTACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name: name, email: email, phone: phone, message: message, website: f.website.value })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.success === true) done();
        else throw new Error((res && res.message) || '');
      })
      .catch(function (e) {
        btn.disabled = false;
        btn.textContent = 'Send message';
        fail((e && e.message && e.message !== 'Failed to fetch') ? e.message : 'Something went wrong sending your message. Please try again in a moment.');
      });
  });

  function done() {
    form.hidden = true;
    var t = document.getElementById('thanks');
    t.hidden = false;
    t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
})();

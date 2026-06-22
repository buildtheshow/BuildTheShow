// Ticketing public page status strip
// Wires a <bts-audition-status-strip> to show "Tickets page is live" / "not published"
// and lets the producer toggle, view, and copy the public link.
(function () {
  'use strict';

  var SB_URL = 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8';

  var _sb = null;
  var _prodId = null;
  var _bound = false;
  var _published = false;

  function sb() {
    if (!_sb && window.supabase) _sb = window.supabase.createClient(SB_URL, SB_KEY);
    return _sb;
  }

  function publicUrl() {
    return window.location.origin + '/PUBLIC/tickets.html?prod=' + encodeURIComponent(_prodId || '');
  }

  function strip() {
    return document.getElementById('tkt-public-status-strip');
  }

  function bindStrip() {
    var el = strip();
    if (!el || _bound) return el;
    el.addEventListener('audition-status-view', function () {
      window.open(publicUrl(), '_blank', 'noopener');
    });
    el.addEventListener('audition-status-copy', function () {
      var url = publicUrl();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          if (typeof el.showCopyConfirmation === 'function') el.showCopyConfirmation('Copied!', 2000);
        }).catch(function () { window.prompt('Copy this link:', url); });
      } else {
        window.prompt('Copy this link:', url);
      }
    });
    el.addEventListener('audition-status-toggle', togglePublished);
    _bound = true;
    return el;
  }

  function renderStrip(published) {
    _published = published;
    var el = bindStrip();
    if (!el || typeof el.update !== 'function') return;
    el.update({
      state: published ? 'live' : 'hidden',
      title: published ? 'Tickets page is live' : 'Tickets page not published',
      subtitle: '',
      showView: published,
      showCopy: published,
      showToggle: true,
      toggleLabel: published ? 'Unpublish' : 'Publish',
    });
    if (typeof el.setVisible === 'function') el.setVisible(true);
    else el.style.display = '';
  }

  async function togglePublished() {
    var client = sb();
    if (!client || !_prodId) return;
    var sess = await client.auth.getSession();
    if (!sess.data.session) { alert('Sign in to manage the tickets page.'); return; }

    var el = strip();
    if (el) { el.style.pointerEvents = 'none'; el.style.opacity = '0.72'; }

    var res = await client.from('productions').select('registration_settings').eq('id', _prodId).single();
    var settings = (res.data && res.data.registration_settings) || {};
    var next = !_published;
    settings.ticketing_published = next;

    var upd = await client.from('productions').update({ registration_settings: settings }).eq('id', _prodId);
    if (el) { el.style.pointerEvents = ''; el.style.opacity = ''; }
    if (upd.error) { alert('Could not save. Please try again.'); return; }
    renderStrip(next);
  }

  window.initTicketingStatusStrip = async function () {
    _prodId = new URLSearchParams(location.search).get('id') || '';
    if (!_prodId) return;
    var client = sb();
    if (!client) return;
    var res = await client.from('productions').select('registration_settings').eq('id', _prodId).single();
    var settings = (res.data && res.data.registration_settings) || {};
    renderStrip(settings.ticketing_published === true);
  };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (document.getElementById('tkt-public-status-strip')) {
        window.initTicketingStatusStrip();
      }
    }, 350);
  });
})();

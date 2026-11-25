/* The existing beta popup is shared by every public signup entrance. */
(function () {
  'use strict';
  let overlay;
  let previousFocus;
  function hide() {
    if (overlay) overlay.style.display = 'none';
    previousFocus?.focus?.();
  }
  function mount() {
    if (overlay) return;
    const holder = document.createElement('div');
    holder.innerHTML = `<div id="beta-signup-overlay" role="dialog" aria-modal="true" aria-labelledby="beta-signup-title" onclick="BTSBetaSignup.hide()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;align-items:center;justify-content:center;">
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:20px;padding:2.5rem 2rem;max-width:420px;width:90%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.28);">
      <div style="font-size:2rem;margin-bottom:0.75rem;">🎭</div>
      <h2 id="beta-signup-title" style="font-family:var(--bts-font);font-size:1.4rem;font-weight:900;color:#000000;margin:0 0 0.6rem;text-transform:uppercase;letter-spacing:0.02em;">We're in Beta Testing</h2>
      <p style="color:#6b5f8a;font-size:0.95rem;line-height:1.55;margin:0 0 1.5rem;">We're inviting a small group to test Build The Show. Have a beta invitation code? Enter it below to sign up.</p>
      <form id="beta-signup-form">
        <label for="beta-code" style="display:block;color:#4a3d6b;font-size:0.82rem;font-weight:700;margin-bottom:0.4rem;">Beta invitation code</label>
        <input id="beta-code" type="text" required maxlength="100" autocomplete="off" spellcheck="false" style="box-sizing:border-box;width:100%;padding:0.8rem;border:1px solid #c8bad7;border-radius:10px;font:inherit;margin-bottom:0.8rem;" />
        <p id="beta-code-error" role="alert" style="color:#d1523d;font-size:0.85rem;"></p>
        <button id="beta-continue" type="submit" style="background:#572e88;color:#fff;border:none;border-radius:10px;padding:0.75rem 2rem;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Continue to Sign Up</button>
        <button type="button" onclick="BTSBetaSignup.hide()" style="background:transparent;color:#572e88;border:none;padding:0.75rem;font:inherit;cursor:pointer;">Close</button>
      </form>
    </div>
  </div>`;
    overlay = holder.firstElementChild;
    document.body.append(overlay);
    const form = overlay.querySelector('#beta-signup-form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const code = overlay.querySelector('#beta-code').value.trim();
      const button = overlay.querySelector('#beta-continue');
      const message = overlay.querySelector('#beta-code-error');
      button.disabled = true; message.textContent = '';
      try {
        const {supabase: client} = await import('/ASSETS/scripts/supabase.js');
        const {data, error} = await client.rpc('bts_check_beta_code', {p_code: code});
        if (error) throw new Error('We could not check your code. Please try again.');
        if (data !== true) throw new Error('That code is invalid, expired or fully used. Check your invitation and try again.');
        sessionStorage.setItem('bts_beta_code', code);
        const destination = new URL('/signup', location.origin);
        const query = new URLSearchParams(location.search);
        for (const key of ['return', 'invite']) if (query.has(key)) destination.searchParams.set(key, query.get(key));
        location.href = destination.pathname + destination.search;
      } catch (error) { message.textContent = error.message || 'We could not check your code. Please try again.'; }
      finally { button.disabled = false; }
    });
  }
  function show(event) {
    event?.preventDefault();
    mount();
    previousFocus = document.activeElement;
    overlay.style.display = 'flex';
    overlay.querySelector('#beta-code-error').textContent = '';
    overlay.querySelector('#beta-code').focus();
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay?.style.display === 'flex') hide();
  });
  window.BTSBetaSignup = {show, hide};
}());

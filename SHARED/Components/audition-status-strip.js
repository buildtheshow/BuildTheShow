(function () {
  if (window.BuildTheShowComponents?.auditionStatusStrip) return;
  window.BuildTheShowComponents = window.BuildTheShowComponents || {};

  const template = document.createElement('template');
  template.innerHTML = `
    <style>
      :host {
        display: block;
        width: fit-content;
        max-width: 100%;
        min-width: 0;
        margin: 0;
      }
      .status-strip {
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        width: 100%;
        min-width: 0;
      }
      .status-line {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        min-width: 0;
      }
      .status-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.14rem;
        min-width: 0;
        width: max-content;
        max-width: 100%;
      }
      .status-dot {
        width: 13px;
        height: 13px;
        border-radius: 999px;
        background: #efab45;
        flex-shrink: 0;
        display: none;
        box-shadow: 0 0 0 0 rgba(239, 171, 69, 0.5);
      }
      .status-title {
        display: block;
        width: 100%;
        font-size: 1.22rem;
        font-weight: 900;
        letter-spacing: 0;
        color: #4a3d6b;
        line-height: 1.05;
        white-space: nowrap;
      }
      .status-sub {
        font-size: 0.76rem;
        color: #8e82a7;
      }
      .status-actions {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 0;
        flex-wrap: nowrap;
        width: 100%;
      }
      .status-action {
        appearance: none;
        border: none;
        background: transparent;
        padding: 0;
        margin: 0;
        font: inherit;
        font-size: 0.73rem;
        font-weight: 600;
        color: #8e82a7;
        cursor: pointer;
        line-height: 1.25;
        transition: color 0.15s ease, opacity 0.15s ease;
      }
      .status-action + .status-action::before {
        content: "|";
        color: #c3bad6;
        margin: 0 0.4rem;
      }
      .status-action:hover {
        color: #5d4f81;
      }
      .copy-confirm {
        display: none;
        font-size: 0.7rem;
        font-weight: 700;
        color: #8e82a7;
        margin-left: 0.45rem;
      }

      :host([state="live"]) .status-dot {
        display: block;
        animation: audition-status-pulse 1.9s ease-out infinite;
      }
      :host([state="hidden"]) .status-sub,
      :host([state="hidden"]) .action-view,
      :host([state="hidden"]) .action-copy,
      :host([state="hidden"]) .copy-confirm,
      :host([state="hidden"]) .status-dot {
        display: none !important;
      }
      :host([state="hidden"]) .status-actions {
        width: auto;
        justify-content: flex-start;
      }
      :host([state="hidden"]) .status-action {
        flex: 0 0 auto;
      }
      :host([state="setup"]) .status-dot,
      :host([state="setup"]) .status-actions {
        display: none;
      }

      @keyframes audition-status-pulse {
        0% { box-shadow: 0 0 0 0 rgba(239, 171, 69, 0.52); }
        70% { box-shadow: 0 0 0 8px rgba(239, 171, 69, 0); }
        100% { box-shadow: 0 0 0 0 rgba(239, 171, 69, 0); }
      }

      @media (max-width: 900px) {
        :host {
          width: fit-content;
          max-width: calc(100% - 4.45rem);
          margin: 0;
        }
        .status-strip,
        .status-line,
        .status-content,
        .status-actions {
          align-items: flex-end;
          justify-content: flex-end;
        }
        .status-line,
        .status-actions { flex-wrap: wrap; }
        .status-content {
          min-width: 0;
          width: auto;
          align-items: flex-end;
        }
        .status-title {
          font-size: 0.94rem;
          white-space: normal;
          text-align: right;
        }
        .status-sub { text-align: right; }
        .status-actions {
          width: auto;
          justify-content: flex-end;
        }
        .status-action {
          flex: 0 0 auto;
        }
        .status-action + .status-action::before {
          margin: 0 0.4rem;
        }
        :host([state="hidden"]) {
          width: fit-content;
          max-width: calc(100% - 4.45rem);
          margin: 0;
        }
      }

      @media (max-width: 560px) {
        :host {
          width: fit-content;
          max-width: calc(100% - 3.95rem);
          margin: 0;
        }
        .status-strip,
        .status-line,
        .status-content,
        .status-actions {
          align-items: flex-end;
          justify-content: flex-end;
        }
        .status-content {
          align-items: flex-end;
        }
        .status-title {
          font-size: 0.86rem;
          text-align: right;
        }
        .status-sub { text-align: right; }
        .status-actions {
          width: 100%;
          gap: 0;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .status-action {
          font-size: 0.64rem;
          letter-spacing: -0.01em;
          flex: 0 0 auto;
        }
        .status-action + .status-action::before {
          margin: 0 0.32rem;
        }
        :host([state="hidden"]) {
          width: fit-content;
          max-width: calc(100% - 3.95rem);
          margin: 0;
        }
      }
    </style>
    <div class="status-strip" part="strip">
      <div class="status-line" part="line">
        <span class="status-dot" part="dot" aria-hidden="true"></span>
        <div class="status-content" part="content">
          <div class="status-title" part="title"></div>
          <div class="status-sub" part="subtitle"></div>
          <div class="status-actions" part="actions">
            <button type="button" class="status-action action-view" part="action action-view">View</button>
            <button type="button" class="status-action action-copy" part="action action-copy">Copy Link</button>
            <button type="button" class="status-action action-toggle" part="action action-toggle"></button>
            <div class="copy-confirm" part="copy-confirm">Copied!</div>
          </div>
        </div>
      </div>
    </div>
  `;

  class BTSAuditionStatusStrip extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
      this._bound = false;
      this._copyTimer = null;
      this._state = {
        state: 'setup',
        title: '',
        subtitle: '',
        showView: false,
        showCopy: false,
        showToggle: false,
        toggleLabel: '',
      };
    }

    connectedCallback() {
      if (!this._bound) {
        this._bindEvents();
        this._bound = true;
      }
      this._render();
    }

    update(nextState) {
      this._state = { ...this._state, ...nextState };
      this._render();
    }

    setVisible(isVisible) {
      this.style.display = isVisible ? '' : 'none';
    }

    showCopyConfirmation(message = 'Copied!', duration = 2000) {
      const confirmEl = this.shadowRoot.querySelector('.copy-confirm');
      if (!confirmEl) return;
      confirmEl.textContent = message;
      confirmEl.style.display = 'inline-block';
      clearTimeout(this._copyTimer);
      this._copyTimer = setTimeout(() => {
        confirmEl.style.display = 'none';
      }, duration);
    }

    _bindEvents() {
      const emit = (name) => {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
      };
      this.shadowRoot.querySelector('.action-view')?.addEventListener('click', () => emit('audition-status-view'));
      this.shadowRoot.querySelector('.action-copy')?.addEventListener('click', () => emit('audition-status-copy'));
      this.shadowRoot.querySelector('.action-toggle')?.addEventListener('click', () => emit('audition-status-toggle'));
    }

    _render() {
      const state = this._state.state || 'setup';
      this.setAttribute('state', state);

      const titleEl = this.shadowRoot.querySelector('.status-title');
      const subtitleEl = this.shadowRoot.querySelector('.status-sub');
      const viewButton = this.shadowRoot.querySelector('.action-view');
      const copyButton = this.shadowRoot.querySelector('.action-copy');
      const toggleButton = this.shadowRoot.querySelector('.action-toggle');

      if (titleEl) titleEl.textContent = this._state.title || '';
      if (subtitleEl) {
        subtitleEl.textContent = this._state.subtitle || '';
        subtitleEl.style.display = this._state.subtitle ? '' : 'none';
      }
      if (viewButton) viewButton.style.display = this._state.showView ? '' : 'none';
      if (copyButton) copyButton.style.display = this._state.showCopy ? '' : 'none';
      if (toggleButton) {
        toggleButton.style.display = this._state.showToggle ? '' : 'none';
        toggleButton.textContent = this._state.toggleLabel || '';
      }
    }
  }

  customElements.define('bts-audition-status-strip', BTSAuditionStatusStrip);
  window.BuildTheShowComponents.auditionStatusStrip = BTSAuditionStatusStrip;
})();

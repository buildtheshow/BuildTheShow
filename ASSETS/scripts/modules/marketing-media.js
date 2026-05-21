/* marketing-media.js — Marketing Media module */
(function () {
  'use strict';

  window.MarketingMediaModule = {
    init: function (prodId, container) {
      container.innerHTML =
        '<div class="aud-visual-hero">' +
          '<div class="aud-visual-hero-content">' +
            '<div>' +
              '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span>Marketing</div>' +
              '<h1 class="aud-visual-title">Media.</h1>' +
              '<p class="aud-visual-copy">Track press coverage, radio mentions, social posts, and other media activity for your production.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mkt-coming-soon">' +
          '<div class="mkt-coming-soon-icon">&#x1F3A5;</div>' +
          '<h3>Coming Soon</h3>' +
          '<p>Log and track every mention, review, and feature your show receives so nothing falls through the cracks.</p>' +
        '</div>';
    },
    destroy: function () {},
  };
})();

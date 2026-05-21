/* marketing-media.js — Marketing Media module */
(function () {
  'use strict';

  window.MarketingMediaModule = {
    init: function (prodId, container) {
      container.innerHTML =
        '<div class="mkt-coming-soon">' +
          '<div class="mkt-coming-soon-icon">&#x1F3A5;</div>' +
          '<h3>Media</h3>' +
          '<p>Track press coverage, radio mentions, social media posts, and other media activity for your production. Coming soon.</p>' +
        '</div>';
    },
    destroy: function () {},
  };
})();

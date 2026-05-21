/* marketing-programme.js — Marketing Programme module */
(function () {
  'use strict';

  window.MarketingProgrammeModule = {
    init: function (prodId, container) {
      container.innerHTML =
        '<div class="mkt-coming-soon">' +
          '<div class="mkt-coming-soon-icon">&#x1F4D6;</div>' +
          '<h3>Programme</h3>' +
          '<p>Build and manage your show programme here, including cast bios, sponsor listings, and ad placements. Coming soon.</p>' +
        '</div>';
    },
    destroy: function () {},
  };
})();

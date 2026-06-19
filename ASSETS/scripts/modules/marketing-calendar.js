/* marketing-calendar.js — Marketing Calendar module */
(function () {
  'use strict';

  window.MarketingCalendarModule = {
    init: function (prodId, container) {
      container.innerHTML =
        '<div class="aud-visual-hero">' +
          '<div class="aud-visual-hero-content">' +
            '<div>' +
              '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span><span class="page-hierarchy"><span class="page-hierarchy-page">Promote</span><span class="page-hierarchy-sep"> - </span><span class="page-hierarchy-sub">Marketing</span></span></div>' +
              '<h1 class="aud-visual-title">Calendar</h1>' +
              '<p class="aud-visual-copy">Plan your social posts, press releases, and promotional campaigns on a shared calendar.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mkt-coming-soon">' +
          '<div class="mkt-coming-soon-icon">&#x1F4C5;</div>' +
          '<h3>Coming Soon</h3>' +
          '<p>Schedule and track your marketing activity in one place, from opening night announcements to social media posts.</p>' +
        '</div>';
    },
    destroy: function () {},
  };
})();

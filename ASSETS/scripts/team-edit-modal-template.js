(function () {
  function esc(value) {
    if (typeof window.esc === 'function') return window.esc(value);
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function render(config = {}) {
    const {
      title = 'Edit Team Member',
      subtitle = 'Update the details shown on their production team card.',
      menuHtml = '',
      accessHtml = '',
      contactHtml = '',
      departmentHtml = '',
      footerHtml = '',
      closeOnclick = '',
      cardClass = 'production-team-member-edit-card',
      modalStyle = 'max-width:1040px;width:min(96vw,1040px);',
    } = config;
    const closeAttr = closeOnclick ? ` onclick="${esc(closeOnclick)}"` : '';
    return `
      <div class="modal ${esc(cardClass)}" style="${esc(modalStyle)}" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div>
            <div class="modal-title">${esc(title)}</div>
            <div class="modal-subtitle">${esc(subtitle)}</div>
          </div>
          <button class="modal-close" type="button" aria-label="Close"${closeAttr}>×</button>
        </div>
        <div class="team-edit-layout">
          <div class="team-edit-menu-pane">${menuHtml}</div>
          <div class="team-edit-form-pane">
            <div class="team-edit-section-title">Contact Info</div>
            ${contactHtml}
            <div class="team-edit-section-title">Department Info</div>
            ${departmentHtml}
            ${accessHtml ? `<div class="team-edit-section-title">Access</div>${accessHtml}` : ''}
          </div>
        </div>
        ${footerHtml}
      </div>`;
  }

  window.BTSTeamEditModalTemplate = {
    render,
  };
})();

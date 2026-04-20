/**
 * ═══════════════════════════════════════════════════════════════
 * CASTING CARD COMPONENT
 * Polaroid-style casting card generator
 * Reusable component for all casting card displays
 * ═══════════════════════════════════════════════════════════════
 * 
 * Data Structure Required:
 * {
 *   "first_name": "FirstName",
 *   "last_name": "LastName",
 *   "age": Age,
 *   "pronouns": "She/Her",
 *   "headshot_url": "...",
 *   "casting_categories": ["Pronouns"], 
 *   "role_openness": "Option"
 * }
 * 
 * role_openness options:
 * - "open" → white "A" in amber dot (open to anything)
 * - "ensemble" → white "E" in purple dot (ensemble-focused)
 * - "specific" → white "S" in black dot (specific roles requested)
 * 
 * casting_categories options (mapped to symbols):
 * - ["She/Her", etc.] → Triangle (female roles)
 * - ["He/Him", etc.] → Square (male roles)
 * - ["They/Them", etc.] → Hexagon (neutral/non-binary)
 * - Multiple → Circle (multiple categories)
 * 
 * Layout Structure:
 * ┌─────────────────────────┐
 * │  1. IMAGE AREA         │  (8:10 portrait ratio)
 * │                        │
 * └─────────────────────────┘
 * ┌─────────────────────────┐
 * │  2. LOWER LANE          │  (icons left, caption centered)
 * │  [first] [last] [age|pr]│
 * └─────────────────────────┘
 */

// ── Escape HTML ───────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}


function getCastingCardTextSize(text, baseSize, minSize, maxChars) {
  const value = String(text || '').trim();
  if (!value) return `${baseSize}cqw`;

  const ratio = value.length > maxChars ? (maxChars / value.length) : 1;
  const fitted = Math.max(minSize, Number((baseSize * ratio).toFixed(3)));
  return `${fitted}cqw`;
}

function isVideoCallAttendanceMode(attendanceMode) {
  const normalized = String(attendanceMode || '').trim().toLowerCase();
  return normalized === 'video_call'
    || normalized === 'video'
    || normalized === 'virtual'
    || normalized === 'video call'
    || normalized === 'on a video call';
}

function getCastingCardVideoCallIconUrl() {
  const version = '20260415-2039';
  try {
    const scriptTag = Array.from(document.scripts || []).find(script =>
      String(script?.src || '').includes('/ASSETS/Scripts%20(JS)/casting-card.js') ||
      String(script?.src || '').includes('/ASSETS/scripts/casting-card.js') ||
      String(script?.src || '').endsWith('casting-card.js')
    );
    if (scriptTag?.src) {
      const url = new URL('../Images/VideoCall.svg', scriptTag.src);
      url.searchParams.set('v', version);
      return url.href;
    }
  } catch {}
  return `ASSETS/Images/VideoCall.svg?v=${version}`;
}

// ── Determine Category Badge (gender) ────────────────────────
function getCategorySymbol(castingCategories) {
  // Legacy alias — delegates to getCategoryBadge
  return getCategoryBadge(castingCategories);
}

function getCategoryBadge(castingCategories) {
  const cats = (castingCategories || []).map(c => (c || '').toLowerCase());
  const hasFemale  = cats.some(c => c.includes('girl') || c.includes('woman') || c.includes('women') || c.includes('female') || c.includes('she') || c.includes('her'));
  const hasMale    = cats.some(c => c.includes('boy')  || c.includes('man')   || c.includes('men')   || c.includes('male')   || c.includes('he')  || c.includes('him'));
  const hasNeutral = cats.some(c => c.includes('non-binary') || c.includes('nonbinary') || c.includes('neutral') || c.includes('nb') || c.includes('they') || c.includes('ze'));

  const count = [hasFemale, hasMale, hasNeutral].filter(Boolean).length;

  if (count === 0 || count > 1) return { text: 'ALL', class: 'all' };
  if (hasFemale)  return { text: 'G/W', class: 'gw' };
  if (hasMale)    return { text: 'B/M', class: 'bm' };
  if (hasNeutral) return { text: 'NB',  class: 'nb' };
  return { text: 'ALL', class: 'all' };
}

// ── Determine Openness Icon ───────────────────────────────────
function getOpennessIcon(roleOpenness) {
  const openness = (roleOpenness || '').toLowerCase();
  
  switch (openness) {
    case 'open':
      return { letter: 'A', class: 'open' };
    case 'ensemble':
      return { letter: 'E', class: 'ensemble' };
    case 'specific':
      return { letter: 'S', class: 'specific' };
    default:
      return { letter: '?', class: 'open' }; // Default to open
  }
}

// ── Render Single Casting Card ─────────────────────────────────
function renderCastingCard(data, options = {}) {
  const {
    size = 'default',
    grid = 'default',
    hasPadding = true,
    hasIcons = true,
    draggable = false,
    state = null,
    indicators = null,
    onClick = null,
    onDragStart = null,
    onDragEnd = null,
    onPointerDown = null,
    id = null,
    title = null,
    firstNameFontSize = null,  // override computed size, e.g. '22cqw'
    variant = null,
  } = options;
  
  const {
    first_name = '',
    last_name = '',
    age = null,
    pronouns = '',
    headshot_url = '',
    casting_categories = [],
    role_openness = 'open',
    attendance_mode = null,
    skill_dots = null,
  } = data;
  
  // Build classes
  const cardClasses = [
    'casting-card',
    size === 'sm' ? 'casting-card--sm' : '',
    size === 'compact' ? 'casting-card--compact' : '',
    variant === 'callbackSimple' ? 'casting-card--callback-simple' : '',
    grid === 'sticky' ? 'casting-card-grid-sticky-item' : '',
    hasPadding ? 'has-padding' : '',
    state ? `state-${state}` : ''
  ].filter(Boolean).join(' ');
  
  // Build attributes
  const attrs = [];
  if (id) attrs.push(`id="${esc(id)}"`);
  if (title) attrs.push(`title="${esc(title)}"`);
  if (draggable) {
    attrs.push('draggable="true"');
    if (onDragStart) attrs.push(`ondragstart="${onDragStart}"`);
    if (onDragEnd) attrs.push(`ondragend="${onDragEnd}"`);
  }
  if (onClick) attrs.push(`onclick="${onClick}"`);
  if (onPointerDown) attrs.push(`onpointerdown="${onPointerDown}"`);
  
  // ── SECTION 1: IMAGE ─────────────────────────────────────────
  let imageHTML;
  if (headshot_url) {
    imageHTML = `<img src="${esc(headshot_url)}" alt="${esc(first_name)} ${esc(last_name)}" class="casting-card-image" loading="lazy" />`;
  } else {
    imageHTML = `
      <div class="casting-card-image-placeholder">
        👤
      </div>
    `;
  }
  
  // ── Lower lane icons (separate from image) ───────────────────
  let iconStackHTML = '';
  if (hasIcons) {
    const categoryBadge = getCategoryBadge(casting_categories);
    const opennessIcon  = getOpennessIcon(role_openness);
    iconStackHTML = `
      <div class="casting-card-icon-stack">
        <div class="casting-icon-category ${categoryBadge.class}" title="Gender preference">${esc(categoryBadge.text)}</div>
        <div class="casting-icon-openness ${opennessIcon.class}" title="Role openness">${opennessIcon.letter}</div>
      </div>
    `;
  }

  let skillDotsHTML = '';
  if (Array.isArray(skill_dots) && skill_dots.length) {
    const normalizeStatus = (value) => {
      const normalized = String(value || '').trim().toLowerCase();
      return ['yes', 'maybe', 'no'].includes(normalized) ? normalized : 'none';
    };
    skillDotsHTML = `
      <div class="casting-card-skill-dots" aria-label="Callback decision markers">
        ${skill_dots.slice(0, 3).map(dot => {
          const label = String(dot?.label || dot?.key || '').slice(0, 1).toUpperCase();
          const status = normalizeStatus(dot?.status || dot?.value);
          const title = dot?.title || `${label || 'Marker'}: ${status === 'none' ? 'Not selected' : status}`;
          return `<div class="casting-card-skill-dot is-${status}" title="${esc(title)}">${esc(label)}</div>`;
        }).join('')}
      </div>
    `;
  }
  
  // ── SECTION 4: RIGHT SIDE INDICATORS ───────────────────────────
  let indicatorsHTML = '';
  if (indicators) {
    const { symbols = '', badge = '' } = indicators;
    const symbolRows = symbols.split('').map(s => `<div>${esc(s)}</div>`).join('');
    const badgeClass = badge ? `casting-card-badge-${badge}` : '';
    
    indicatorsHTML = `
      <div class="casting-card-indicators">
        ${symbols ? `<div class="casting-card-symbols">${symbolRows}</div>` : ''}
        ${badge ? `<div class="casting-card-badge ${badgeClass}">${esc(badge)}</div>` : ''}
      </div>
    `;
  }
  
  // Caption display
  const firstLine = first_name || '';
  const secondLine = `${last_name || ''}`;
  const thirdParts = [];
  if (age !== null && age !== undefined && age !== '') thirdParts.push(String(age));
  if (pronouns) thirdParts.push(String(pronouns));
  const thirdLine = thirdParts.join(' | ');
  const firstNameSize = firstNameFontSize || getCastingCardTextSize(firstLine, 10.6, 5.2, 8);
  const lastNameSize = getCastingCardTextSize(secondLine, 5.8, 3.1, 14);
  const metaLineSize = getCastingCardTextSize(thirdLine, 4.2, 2.3, 18);
  
  // ── Video call badge ──────────────────────────────────────────
  const videoCallBadge = isVideoCallAttendanceMode(attendance_mode)
    ? `<img src="${esc(getCastingCardVideoCallIconUrl())}" class="casting-card-videocall-badge" alt="Video Call" />`
    : '';

  // ── Build the card HTML ───────────────────────────────────────
  return `
    <div class="${cardClasses}" ${attrs.join(' ')}>
      <div class="casting-card-image-area">
        ${imageHTML}
        ${indicatorsHTML}
        ${videoCallBadge}
      </div>
      <div class="casting-card-lower">
        <div class="casting-card-lower-icons">
          ${iconStackHTML}
        </div>
        <div class="casting-card-caption">
          <div class="casting-card-first-name" style="font-size:${firstNameSize};">${esc(first_name)}</div>
          <div class="casting-card-last-name" style="font-size:${lastNameSize};">${esc(last_name)}</div>
          <div class="casting-card-meta-line" style="font-size:${metaLineSize};">${esc(thirdLine)}</div>
        </div>
        ${skillDotsHTML}
      </div>
    </div>
  `;
}

// ── Render Grid of Casting Cards ──────────────────────────────
function renderCastingCardsGrid(dataArray, options = {}) {
  if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
    return `<div class="empty-state">No casting cards to display.</div>`;
  }
  
  const { grid = 'default' } = options;
  
  // Remove the wrapper for sticky/compact grids (they handle their own containers)
  if (grid === 'sticky' || grid === 'compact') {
    return dataArray.map(data => renderCastingCard(data, {
      ...options,
      title: grid === 'sticky' ? `${data.first_name || ''} ${data.last_name || ''} ${data.age || ''}` : null
    })).join('');
  }
  
  const cardsHTML = dataArray.map(data => renderCastingCard(data, options)).join('');
  
  return `
    <div class="casting-cards-grid">
      ${cardsHTML}
    </div>
  `;
}

// ── Helper: Generate indicators for casting board ──────────────
function generateCastingBoardIndicators(castingCategories, roleOpenness, assignedCharacter = null) {
  const categorySymbol = getCategorySymbol(castingCategories);
  const symbols = categorySymbol.symbol !== '?' ? categorySymbol.symbol : '';
  
  let badge = '';
  if (assignedCharacter) {
    badge = 'C';
  } else {
    const openness = getOpennessIcon(roleOpenness);
    switch (openness.letter) {
      case 'A': badge = 'A'; break;
      case 'E': badge = 'E'; break;
      case 'S': badge = 'S'; break;
    }
  }
  
  return { symbols, badge };
}

// ── Drag and Drop helpers ─────────────────────────────────────
function ccardDragStart(e, appId, charId = null) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ appId, charId }));
  e.dataTransfer.effectAllowed = 'move';
  e.target.classList.add('dragging');
}

function ccardDragEnd(e) {
  e.target.classList.remove('dragging');
}

// ── Export for use in other modules ────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderCastingCard,
    renderCastingCardsGrid,
    getCategorySymbol,
    getOpennessIcon,
    generateCastingBoardIndicators,
    ccardDragStart,
    ccardDragEnd,
    esc
  };
}

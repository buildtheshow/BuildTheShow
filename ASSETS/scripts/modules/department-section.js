/* department-section.js - reusable production department section page */
(function () {
  'use strict';

  const SUPABASE_URL = window.SUPABASE_URL || 'https://tkmaiktxpwqfbgeojbnf.supabase.co';
  const KEY = window.SUPABASE_ANON_KEY || '';

  const state = {
    prodId: '',
    group: null,
    section: null,
    tab: 'dashboard',
    categories: [],
    receipts: [],
    opportunities: [],
    signups: [],
    events: [],
    staffingPlan: {},
    editingReceiptId: '',
  };

  const STAFFING_ROLE_MAP = {
    dept_leads: [
      { dept: 'Backstage & Rehearsal Support', name: 'Stage Manager' }, { dept: 'Front of House', name: 'Front of House Manager' }, { dept: 'Front of House', name: 'Concession Manager' }, { dept: 'Technical Crew', name: 'Lighting Designer / Technician' }, { dept: 'Design & Construction', name: 'Lead Builder' }, { dept: 'Design & Construction', name: 'Lead Set Painter' }, { dept: 'Design & Construction', name: 'Lead Prop Person' }, { dept: 'Costume & Makeup', name: 'Costume Designer' }, { dept: 'Marketing & Publicity', name: 'Marketing Director' }, { dept: 'Backstage & Rehearsal Support', name: 'Cast Party Coordinator' }, { dept: 'Technical Crew', name: 'Sound / Audio Technician' },
    ],
    performance: [
      { dept: 'Front of House', name: 'Ushers' }, { dept: 'Front of House', name: 'Concession Workers' }, { dept: 'Front of House', name: 'Ticket Sales' }, { dept: 'Backstage & Rehearsal Support', name: 'Backstage Crew' }, { dept: 'Backstage & Rehearsal Support', name: 'Quick-Change Assistant' }, { dept: 'Backstage & Rehearsal Support', name: 'Child Wrangler' }, { dept: 'Technical Crew', name: 'Mic Wrangler' }, { dept: 'Technical Crew', name: 'Spotlight Operators' },
    ],
    tech: [
      { dept: 'Technical Crew', name: 'Mic Wrangler' }, { dept: 'Backstage & Rehearsal Support', name: 'Quick-Change Assistant' }, { dept: 'Backstage & Rehearsal Support', name: 'Backstage Crew' },
    ],
    dress: [
      { dept: 'Technical Crew', name: 'Mic Wrangler' }, { dept: 'Backstage & Rehearsal Support', name: 'Quick-Change Assistant' }, { dept: 'Backstage & Rehearsal Support', name: 'Backstage Crew' }, { dept: 'Backstage & Rehearsal Support', name: 'Child Wrangler' },
    ],
    rehearsal: [
      { dept: 'Backstage & Rehearsal Support', name: 'Rehearsal Assistant' }, { dept: 'Backstage & Rehearsal Support', name: 'Child Wrangler' },
    ],
    music_rehearsal: [{ dept: 'Backstage & Rehearsal Support', name: 'Rehearsal Assistant' }],
    choreography: [{ dept: 'Backstage & Rehearsal Support', name: 'Rehearsal Assistant' }],
    strike: [{ dept: 'Design & Construction', name: 'Set Strike Crew' }],
    costume_moveout: [{ dept: 'Costume & Makeup', name: 'Costume Move-Out Crew' }],
    cast_party: [{ dept: 'Backstage & Rehearsal Support', name: 'Cast Party Helper' }],
    crew: [{ dept: 'Design & Construction', name: 'Build Crew Helper' }],
    crew_set: [{ dept: 'Design & Construction', name: 'Set Builder' }],
    crew_set_painting: [{ dept: 'Design & Construction', name: 'Set Painter' }],
    crew_set_dressing: [{ dept: 'Design & Construction', name: 'Set Dresser' }],
    crew_costumes: [{ dept: 'Costume & Makeup', name: 'Costume Work Helper' }],
    crew_props: [{ dept: 'Design & Construction', name: 'Props Helper' }],
    crew_hair_makeup: [{ dept: 'Costume & Makeup', name: 'Hair & Makeup Crew' }],
    crew_wigs: [{ dept: 'Costume & Makeup', name: 'Wig Crew' }],
    crew_lighting: [{ dept: 'Technical Crew', name: 'Lighting Crew' }],
    crew_sound: [{ dept: 'Technical Crew', name: 'Sound Crew' }],
    other: [
      { dept: 'Costume & Makeup', name: 'Costume Washer' }, { dept: 'Front of House', name: 'Bakers / Treat Contributors' }, { dept: 'Marketing & Publicity', name: 'Promotion Distribution' },
    ],
  };

  const PER_PRODUCTION_TYPES = new Set(['dept_leads', 'other']);

  function esc(value) {
    return value == null ? '' : String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function headers(json) {
    const out = { apikey: KEY, Authorization: 'Bearer ' + KEY };
    if (json) {
      out['Content-Type'] = 'application/json';
      out.Prefer = 'return=representation';
    }
    return out;
  }

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function fmtMoney(cents) {
    const amount = (parseInt(cents, 10) || 0) / 100;
    return '$' + amount.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function fmtDate(date) {
    if (!date) return 'No date';
    const parsed = new Date(date + 'T12:00:00');
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtTime(value) {
    if (!value) return '';
    const raw = String(value).includes('T') ? String(value).split('T')[1] : String(value);
    const parts = raw.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parts[1] || '00';
    if (!Number.isFinite(hour)) return '';
    return (hour % 12 || 12) + ':' + minute + ' ' + (hour < 12 ? 'AM' : 'PM');
  }

  function fmtTimeRange(start, end) {
    const a = fmtTime(start);
    const b = fmtTime(end);
    if (a && b) return a + ' - ' + b;
    return a || b || '';
  }

  function fmtEventDate(value) {
    if (!value) return 'Date TBC';
    return fmtDate(String(value).slice(0, 10));
  }

  function config() {
    return window.BTSDepartmentConfig;
  }

  function setRoute(tab) {
    state.tab = tab || 'dashboard';
    const next = new URL(window.location.href);
    next.searchParams.set('group', state.group.key);
    next.searchParams.set('section', state.section.key);
    next.searchParams.set('tab', state.tab);
    window.history.replaceState({}, '', next.toString());
    render();
  }

  function categoryAliases() {
    return [state.section.label].concat(state.section.categoryAliases || []);
  }

  function norm(value) {
    return String(value || '').trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');
  }

  function canonicalVolunteerRoleName(name) {
    const raw = String(name || '').trim();
    const key = norm(raw);
    const renames = {
      'build crew helper': 'Set Builders',
      'set builder': 'Set Builders',
      'costume work helper': 'Costume Helper',
    };
    return renames[key] || raw;
  }

  function volunteerRoleKey(name) {
    return norm(canonicalVolunteerRoleName(name));
  }

  function sectionCategories() {
    const aliases = categoryAliases().map(norm);
    return state.categories.filter(function (cat) {
      const name = norm(cat.name);
      if (!name) return false;
      return aliases.some(function (alias) {
        return name === alias || name.includes(alias) || alias.includes(name);
      });
    });
  }

  function sectionReceipts() {
    const ids = new Set(sectionCategories().map(function (cat) { return cat.id; }));
    return state.receipts.filter(function (receipt) { return ids.has(receipt.category_id); });
  }

  function sectionMatchesText() {
    const aliases = categoryAliases().map(norm);
    return function (value) {
      const text = norm(value);
      if (!text) return false;
      return aliases.some(function (alias) { return text === alias || text.includes(alias) || alias.includes(text); });
    };
  }

  function groupHasSingleSection() {
    return state.group &&
      Array.isArray(state.group.sections) &&
      state.group.sections.length === 1;
  }

  function sectionOpportunities() {
    const matches = sectionMatchesText();
    return state.opportunities.filter(function (opp) {
      return matches(opp.volunteer_role) || matches(opp.production_title) || matches(opp.summary) || matches(opp.description);
    });
  }

  function signupMatchesSection(signup) {
    const matches = sectionMatchesText();
    const roleMatches = matches(signup.role_name) ||
      matches(signup.volunteer_role) ||
      matches(signup.production_title);
    if (roleMatches) return true;
    if (!groupHasSingleSection()) return false;
    return matches(signup.department) ||
      matches(signup.dept_category) ||
      matches(signup.volunteer_department);
  }

  function sectionSignups(opportunities) {
    const ids = new Set((opportunities || sectionOpportunities()).map(function (opp) { return opp.id; }));
    return state.signups.filter(function (signup) {
      const status = norm(signup.status);
      return (ids.has(signup.opportunity_id) || signupMatchesSection(signup)) &&
        status !== 'declined' &&
        status !== 'rejected' &&
        status !== 'cancelled';
    });
  }

  function planEntryBaseType(key) {
    return Object.keys(STAFFING_ROLE_MAP)
      .sort(function (a, b) { return b.length - a.length; })
      .find(function (type) { return key === type || String(key || '').indexOf(type + '-') === 0; }) || '';
  }

  function planEntryRoleIndex(key, baseType) {
    const raw = String(key || '').slice(String(baseType || '').length + 1);
    const match = raw.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : -1;
  }

  function planCanonicalType(type) {
    if (type === 'dance_call' || type === 'callback' || type === 'other_audition') return 'audition';
    if (type === 'music_rehearsal' || type === 'choreography') return 'rehearsal';
    if (String(type || '').indexOf('crew_') === 0) return 'crew';
    if (type === 'cast_party' || type === 'deadline') return 'event';
    return type;
  }

  function planTypeAliases(type) {
    if (type === 'audition') return ['audition', 'dance_call', 'callback', 'other_audition'];
    if (type === 'rehearsal') return ['rehearsal', 'music_rehearsal', 'choreography'];
    if (type === 'crew') return ['crew', 'crew_set', 'crew_set_painting', 'crew_set_dressing', 'crew_costumes', 'crew_props', 'crew_hair_makeup', 'crew_wigs', 'crew_lighting', 'crew_sound'];
    if (type === 'event') return ['event', 'cast_party', 'deadline'];
    return [type];
  }

  function eventPlanType(event) {
    const raw = event.event_type || '';
    if (event.is_deadline || raw === 'deadline' || /deadline/i.test(event.title || '')) return 'deadline';
    if (/cast\s*party/i.test(event.title || '')) return 'cast_party';
    return raw;
  }

  function planEventMatchesType(event, type) {
    return planTypeAliases(type).indexOf(eventPlanType(event)) !== -1;
  }

  function planEntryCountMode(key, entry) {
    const mode = entry.countMode || entry.count_mode;
    if (mode === 'per_production' || mode === 'per_event') return mode;
    const label = norm(entry.perLabel || entry.per_label || '');
    if (label.indexOf('production') !== -1 || label.indexOf('total') !== -1) return 'per_production';
    return PER_PRODUCTION_TYPES.has(planEntryBaseType(key)) ? 'per_production' : 'per_event';
  }

  function planEntryAppliesTo(key, entry) {
    const raw = Array.isArray(entry.appliesTo) ? entry.appliesTo : (Array.isArray(entry.applies_to) ? entry.applies_to : [planEntryBaseType(key)]);
    return raw.map(planCanonicalType).filter(Boolean);
  }

  function planEntryAllowsEvent(entry, eventType, eventId) {
    const scope = (entry.eventScope && entry.eventScope[eventType]) || (entry.event_scope && entry.event_scope[eventType]);
    if (!scope || scope.mode !== 'specific' || !Array.isArray(scope.ids)) return true;
    return scope.ids.map(String).indexOf(String(eventId || '')) !== -1;
  }

  function planEntryAllowedEventTypes(key, entry) {
    const baseType = planEntryBaseType(key);
    const scopedIds = [];
    const scopes = entry.eventScope || entry.event_scope || {};
    Object.keys(scopes).forEach(function (scopeKey) {
      const scope = scopes[scopeKey];
      if (scope && scope.mode === 'specific' && Array.isArray(scope.ids)) {
        scopedIds.push.apply(scopedIds, scope.ids.map(String));
      }
    });
    return { baseType, scopedIds };
  }

  function entryField(entry, camelName, snakeName, fallback) {
    if (entry && entry[camelName] !== undefined && entry[camelName] !== null && entry[camelName] !== '') return entry[camelName];
    if (entry && entry[snakeName] !== undefined && entry[snakeName] !== null && entry[snakeName] !== '') return entry[snakeName];
    return fallback;
  }

  function parseEventDateTime(value) {
    if (!value) return null;
    const raw = String(value);
    const date = raw.slice(0, 10);
    const match = raw.match(/T(\d{2}):(\d{2})/);
    if (!date || !match) return null;
    return { date, mins: Number(match[1]) * 60 + Number(match[2]) };
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function normalizeDateMinutes(date, mins) {
    let nextDate = date;
    let nextMins = mins;
    while (nextMins < 0) {
      nextMins += 1440;
      nextDate = addDays(nextDate, -1);
    }
    while (nextMins >= 1440) {
      nextMins -= 1440;
      nextDate = addDays(nextDate, 1);
    }
    return { date: nextDate, time: String(Math.floor(nextMins / 60)).padStart(2, '0') + ':' + String(nextMins % 60).padStart(2, '0') };
  }

  function applyAnchor(base, mins, anchor) {
    const start = parseEventDateTime(base.start_time);
    const end = parseEventDateTime(base.end_time);
    if (!start && !end) return null;
    if (anchor === 'own_time') return null;
    if (anchor === 'after_start') return normalizeDateMinutes(start.date, start.mins + mins);
    if (anchor === 'before_end') return normalizeDateMinutes((end || start).date, (end || start).mins - mins);
    if (anchor === 'before_event_start') return normalizeDateMinutes((start || end).date, -mins);
    if (anchor === 'after_event_end') return normalizeDateMinutes((end || start).date, 1440 + mins);
    if (anchor === 'after_end') return normalizeDateMinutes((end || start).date, (end || start).mins + mins);
    return normalizeDateMinutes((start || end).date, (start || end).mins - mins);
  }

  function roleShiftTiming(event, entry) {
    const shiftStartAnchor = entryField(entry, 'shiftStartAnchor', 'shift_start_anchor', 'before_start');
    const shiftEndAnchor = entryField(entry, 'shiftEndAnchor', 'shift_end_anchor', 'after_end');
    if (shiftStartAnchor === 'own_time' || shiftEndAnchor === 'own_time') {
      return { shift_date: null, shift_start_time: null, shift_end_time: null };
    }
    const startMins = parseInt(entryField(entry, 'shiftStartMins', 'shift_start_mins', 0), 10) || 0;
    const endMins = parseInt(entryField(entry, 'shiftEndMins', 'shift_end_mins', 0), 10) || 0;
    const start = applyAnchor(event, startMins, shiftStartAnchor);
    const end = applyAnchor(event, endMins, shiftEndAnchor);
    return {
      shift_date: (start && start.date) || String(event.start_time || '').slice(0, 10) || null,
      shift_start_time: start && start.time,
      shift_end_time: end && end.time,
    };
  }

  function defaultPlanRole(key, entry) {
    const baseType = planEntryBaseType(key);
    const roles = STAFFING_ROLE_MAP[baseType] || [];
    const idx = planEntryRoleIndex(key, baseType);
    const fallback = idx >= 0 ? roles[idx] : null;
    return {
      name: canonicalVolunteerRoleName(entry.roleName || entry.role_name || (fallback && fallback.name) || ''),
      dept: entry.department || entry.dept || (fallback && fallback.dept) || '',
    };
  }

  function staffingPlanDemandRows() {
    const matches = sectionMatchesText();
    const rows = [];
    Object.keys(state.staffingPlan || {}).forEach(function (key) {
      const entry = state.staffingPlan[key] || {};
      if (entry.hidden) return;
      const count = parseInt(entry.count ?? entry.qty ?? entry.volunteers_needed, 10) || 0;
      if (count <= 0) return;
      const role = defaultPlanRole(key, entry);
      if (!role.name || (!matches(role.name) && !(groupHasSingleSection() && matches(role.dept)))) return;
      let multiplier = 1;
      if (planEntryCountMode(key, entry) !== 'per_production') {
        const types = planEntryAppliesTo(key, entry);
        multiplier = state.events.filter(function (event) {
          return types.some(function (type) {
            return planEventMatchesType(event, type) && planEntryAllowsEvent(entry, type, event.id);
          });
        }).length;
      }
      if (multiplier <= 0) return;
      rows.push({ role: role.name, needed: count * multiplier, source: 'plan' });
    });
    return rows;
  }

  function opportunityDemandRows(opportunities) {
    return (opportunities || sectionOpportunities())
      .filter(function (opp) { return norm(opp.status) !== 'cancelled'; })
      .map(function (opp) {
        return {
          role: canonicalVolunteerRoleName(opp.production_title || opp.volunteer_role || opp.summary || ''),
          needed: parseInt(opp.volunteers_needed, 10) || 0,
          source: 'opportunity',
        };
      })
      .filter(function (row) { return row.role && row.needed > 0; });
  }

  function addDemand(map, row) {
    const key = volunteerRoleKey(row.role);
    if (!key) return;
    map[key] = (map[key] || 0) + row.needed;
  }

  function volunteerStats(opportunities, signups) {
    const acceptedStatuses = new Set(['approved', 'checked_in', 'completed']);
    const activeStatuses = new Set(['pending', 'approved', 'partially_filled', 'checked_in', 'completed']);
    const acceptedSignups = signups.filter(function (s) { return acceptedStatuses.has(norm(s.status)); });
    const activeSignups = signups.filter(function (s) { return activeStatuses.has(norm(s.status)); });
    const planDemand = {};
    const opportunityDemand = {};
    staffingPlanDemandRows().forEach(function (row) { addDemand(planDemand, row); });
    opportunityDemandRows(opportunities).forEach(function (row) { addDemand(opportunityDemand, row); });

    const demand = {};
    Object.keys(planDemand).forEach(function (key) { demand[key] = planDemand[key]; });
    Object.keys(opportunityDemand).forEach(function (key) {
      if (!planDemand[key]) demand[key] = opportunityDemand[key];
    });

    const occupied = {};
    activeSignups.forEach(function (signup) {
      const key = volunteerRoleKey(signupRole(signup));
      if (key) occupied[key] = (occupied[key] || 0) + 1;
    });

    let rawNeeded = Object.keys(demand).reduce(function (sum, key) { return sum + demand[key]; }, 0);
    let open = Object.keys(demand).reduce(function (sum, key) {
      return sum + Math.max(0, demand[key] - (occupied[key] || 0));
    }, 0);
    if (!rawNeeded) {
      rawNeeded = opportunities.reduce(function (sum, opp) { return sum + (parseInt(opp.volunteers_needed, 10) || 0); }, 0);
      open = Math.max(0, rawNeeded - activeSignups.length);
    }

    const assigned = acceptedSignups.length;
    const needed = Math.max(rawNeeded, assigned);
    return { assigned, open: Math.max(0, open), needed, acceptedSignups };
  }

  function planShiftRows() {
    const matches = sectionMatchesText();
    const rows = [];
    Object.keys(state.staffingPlan || {}).forEach(function (key) {
      const entry = state.staffingPlan[key] || {};
      if (entry.hidden) return;
      const count = parseInt(entry.count ?? entry.qty ?? entry.volunteers_needed, 10) || 0;
      if (count <= 0) return;
      const role = defaultPlanRole(key, entry);
      if (!role.name || (!matches(role.name) && !(groupHasSingleSection() && matches(role.dept)))) return;
      if (planEntryCountMode(key, entry) === 'per_production') return;
      const allowed = planEntryAllowedEventTypes(key, entry);
      state.events.forEach(function (event) {
        if (allowed.scopedIds.length) {
          if (allowed.scopedIds.indexOf(String(event.id || '')) === -1) return;
        } else if (eventPlanType(event) !== allowed.baseType) {
          return;
        }
        const timing = roleShiftTiming(event, entry);
        if (!timing.shift_date) return;
        rows.push({
          role: role.name,
          title: role.name,
          eventTitle: event.title || '',
          date: timing.shift_date,
          start: timing.shift_start_time,
          end: timing.shift_end_time,
          venue: event.venue || '',
          needed: count,
          source: 'plan',
        });
      });
    });
    return rows;
  }

  function opportunityShiftRows(opportunities) {
    return (opportunities || sectionOpportunities())
      .filter(function (opp) { return norm(opp.status) !== 'cancelled'; })
      .map(function (opp) {
        const date = opp.event_date || opp.shift_date || '';
        return {
          role: canonicalVolunteerRoleName(opp.production_title || opp.volunteer_role || opp.summary || ''),
          title: canonicalVolunteerRoleName(opp.production_title || opp.volunteer_role || 'Volunteer Shift'),
          eventTitle: opp.summary || '',
          date: String(date || '').slice(0, 10),
          start: opp.shift_start_time || '',
          end: opp.shift_end_time || '',
          venue: opp.location_text || '',
          needed: parseInt(opp.volunteers_needed, 10) || 0,
          source: 'opportunity',
        };
      })
      .filter(function (row) { return row.role && row.date; });
  }

  function sectionShiftRows(opportunities) {
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set();
    return planShiftRows()
      .concat(opportunityShiftRows(opportunities))
      .filter(function (row) { return row.date >= today; })
      .sort(function (a, b) {
        return String(a.date || '').localeCompare(String(b.date || '')) ||
          String(a.start || '').localeCompare(String(b.start || '')) ||
          String(a.title || '').localeCompare(String(b.title || ''));
      })
      .filter(function (row) {
        const key = [volunteerRoleKey(row.role), row.date, row.start || '', row.end || ''].join('::');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function sectionEvents() {
    const matches = sectionMatchesText();
    const now = new Date().toISOString();
    return state.events
      .filter(function (event) {
        return String(event.start_time || '') >= now && (
          matches(event.title) ||
          matches(event.notes) ||
          matches(event.event_type)
        );
      })
      .sort(function (a, b) { return String(a.start_time || '').localeCompare(String(b.start_time || '')); });
  }

  function receiptSubmitter(receipt) {
    return receipt.submitted_by_name || receipt.submitted_by || receipt.submitted_by_email || 'No submitter';
  }

  function receiptTitle(receipt) {
    return receipt.vendor || receipt.description || 'Receipt';
  }

  function statusLabel(status) {
    const labels = { pending: 'Pending', approved: 'Approved', paid: 'Paid', rejected: 'Rejected' };
    return labels[status] || status || 'Pending';
  }

  function percent(value, total) {
    if (!total || total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
  }

  async function fetchTable(table, extra) {
    if (!KEY || !state.prodId) return [];
    const response = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?production_id=eq.' + encodeURIComponent(state.prodId) + (extra || ''), { headers: headers() });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  async function fetchProduction() {
    if (!KEY || !state.prodId) return null;
    const response = await fetch(SUPABASE_URL + '/rest/v1/productions?id=eq.' + encodeURIComponent(state.prodId) + '&select=volunteer_staffing_plan', { headers: headers() });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    return rows && rows[0] ? rows[0] : null;
  }

  async function loadData() {
    const safe = function (promise) { return promise.catch(function () { return []; }); };
    const results = await Promise.all([
      safe(fetchTable('budget_categories', '&type=eq.expense&order=sort_order.asc,created_at.asc')),
      safe(fetchTable('budget_receipts', '&order=created_at.desc')),
      safe(fetchTable('opportunities', '&select=id,production_title,volunteer_role,volunteers_needed,status,summary,description,event_date,time_commitment,created_at,updated_at&opportunity_type=in.(volunteer,creative_team)&order=created_at.desc')),
      safe(fetchTable('volunteer_signups', '&order=created_at.desc')),
      safe(fetchTable('production_events', '&select=id,title,event_type,start_time,end_time,venue,notes,is_deadline&order=start_time.asc')),
      safe(fetchProduction()),
    ]);
    state.categories = results[0] || [];
    state.receipts = results[1] || [];
    state.opportunities = results[2] || [];
    state.signups = results[3] || [];
    state.events = results[4] || [];
    state.staffingPlan = (results[5] && results[5].volunteer_staffing_plan) || {};
  }

  function tabTitle() {
    if (state.tab === 'dashboard') return 'Dashboard';
    if (state.tab === 'planning') return 'Planning';
    if (state.tab === 'receipts') return 'Receipts';
    return 'Dashboard';
  }

  function renderHero() {
    const hierarchy = [
      '<span class="page-hierarchy-page">Production Departments</span>',
      '<span class="page-hierarchy-sep">-</span>',
      '<span class="page-hierarchy-sub">' + esc(state.group.label) + '</span>',
    ].join('');
    return '<div class="aud-visual-hero dept-hero" style="--dept-color:' + esc(state.group.color) + ';">' +
      '<div class="aud-visual-hero-content"><div>' +
        '<div class="aud-visual-kicker"><span class="aud-visual-kicker-dot" aria-hidden="true"></span><span class="page-hierarchy">' + hierarchy + '</span></div>' +
        '<h1 class="aud-visual-title">' + esc(state.section.label + ' ' + tabTitle()) + '</h1>' +
        '<p class="aud-visual-copy">' + esc(state.section.description) + '</p>' +
      '</div></div>' +
      '<div class="dept-hero-deco"><img src="' + esc(state.group.icon) + '" alt="" /></div>' +
    '</div>';
  }

  function activeTabs() {
    return (state.group && state.group.tabs) || config().tabs;
  }

  function renderTabs() {
    return '<div class="dept-tabs" role="tablist">' + activeTabs().map(function (tab) {
      return '<button type="button" class="dept-tab' + (tab.key === state.tab ? ' active' : '') + '" onclick="BTSDepartmentSection.openTab(\'' + esc(tab.key) + '\')" role="tab" aria-selected="' + (tab.key === state.tab ? 'true' : 'false') + '">' + esc(tab.label) + '</button>';
    }).join('') + '</div>';
  }

  function isCostumeTab() {
    return state.group && state.group.key === 'costumes' && state.tab && state.tab.indexOf('costume-') === 0;
  }

  function isReceiptFormTab() {
    if (!state.tab || state.tab !== 'receipts') return false;
    var tabs = activeTabs();
    var t = tabs.find(function (tab) { return tab.key === 'receipts'; });
    return !!(t && t.receiptForm);
  }

  function activeCostumeTabKey() {
    var tabs = activeTabs();
    var t = tabs.find(function (tab) { return tab.key === state.tab; });
    return (t && t.costumeTab) || 'groups';
  }

  function isCostumePlanningSection() {
    return isCostumeTab();
  }

  function renderCostumePlanningMount() {
    return '<div class="dept-costume-planning-native" id="dept-costume-planning-native">' +
      '<div class="dept-empty">Loading costume planning...</div>' +
    '</div>';
  }

  function prefixCostumeSelector(selector) {
    var trimmed = selector.trim();
    if (!trimmed || trimmed.indexOf('.dept-costume-inline') === 0) return trimmed;
    if (trimmed === '.costume-embed') return '.dept-costume-inline';
    if (trimmed.indexOf('.costume-embed ') === 0) trimmed = trimmed.slice(15);
    if (trimmed.indexOf('.costume-embed.') === 0) return '.dept-costume-inline' + trimmed.slice(14);
    if (trimmed === 'html' || trimmed === 'body') return '.dept-costume-inline';
    if (trimmed.indexOf('html ') === 0) trimmed = trimmed.slice(5);
    if (trimmed.indexOf('body ') === 0) trimmed = trimmed.slice(5);
    if (trimmed.indexOf('body.') === 0) return '.dept-costume-inline' + trimmed.slice(4);
    return '.dept-costume-inline ' + trimmed;
  }

  function serializeCostumeCssRule(rule) {
    if (rule.type === CSSRule.STYLE_RULE) {
      var selectors = rule.selectorText.split(',').map(prefixCostumeSelector).join(', ');
      return selectors + '{' + rule.style.cssText + '}';
    }
    if (rule.type === CSSRule.MEDIA_RULE) {
      return '@media ' + rule.conditionText + '{' + Array.from(rule.cssRules).map(serializeCostumeCssRule).join('') + '}';
    }
    if (rule.type === CSSRule.KEYFRAMES_RULE || rule.type === CSSRule.FONT_FACE_RULE) return rule.cssText;
    return rule.cssText || '';
  }

  async function prefixedCostumeCss(rawCss) {
    try {
      var sheet = new CSSStyleSheet();
      await sheet.replace(rawCss);
      return Array.from(sheet.cssRules).map(serializeCostumeCssRule).join('\n') +
        '\n.dept-costume-inline{display:block;min-height:auto;width:100%;max-width:100%;overflow:visible;background:transparent;}' +
        '\n.dept-costume-inline .costume-content{padding:0;border:none;background:transparent;}' +
        '\n.dept-costume-inline .costume-panel{padding:1.5rem 0;}' +
        '\n.dept-costume-inline #prod-sidebar-host,.dept-costume-inline .hero-wrap,.dept-costume-inline .costume-nav{display:none!important;}';
    } catch (error) {
      throw new Error('Could not prepare costume planner styles');
    }
  }

  async function mountCostumePlanningNative() {
    var mount = document.getElementById('dept-costume-planning-native');
    if (!mount) return;
    try {
      var response = await fetch('/SYSTEM/Organisations/Productions/Workspace/departments-costume.html?id=' + encodeURIComponent(state.prodId) + '&embed=1', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load costume planner');
      var html = await response.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var styleText = Array.from(doc.querySelectorAll('style')).map(function (style) { return style.textContent || ''; }).join('\n');
      var nav = doc.getElementById('costume-nav');
      var content = doc.querySelector('.costume-content');
      var overlay = doc.getElementById('c-overlay');
      if (!nav || !content || !overlay) throw new Error('Costume planner markup was incomplete');
      if (!document.getElementById('dept-costume-inline-style')) {
        var styleEl = document.createElement('style');
        styleEl.id = 'dept-costume-inline-style';
        styleEl.textContent = await prefixedCostumeCss(styleText);
        document.head.appendChild(styleEl);
      }
      mount.innerHTML = '';
      var scope = document.createElement('div');
      scope.className = 'dept-costume-inline';
      // Omit the costume nav — department section tabs take its place
      scope.appendChild(content.cloneNode(true));
      scope.appendChild(overlay.cloneNode(true));
      mount.appendChild(scope);
      var targetCostumeTab = activeCostumeTabKey();
      if (!window.BTSCostumePlannerInlineLoaded) {
        var scripts = Array.from(doc.querySelectorAll('script')).map(function (script) { return script.textContent || ''; }).filter(Boolean);
        var plannerScript = scripts[scripts.length - 1] || '';
        plannerScript = plannerScript
          .replace("const isEmbed = new URLSearchParams(location.search).get('embed') === '1';", 'const isEmbed = true;')
          .replace("prodId = new URLSearchParams(location.search).get('id');", 'prodId = "' + state.prodId.replace(/"/g, '\\"') + '";')
          .replace("window.addEventListener('DOMContentLoaded', init);", 'window.BTSCostumePlannerInit = init; init().then(function(){ if(typeof window.showTab==="function") window.showTab("' + targetCostumeTab + '"); });');
        var scriptEl = document.createElement('script');
        scriptEl.textContent = plannerScript;
        document.body.appendChild(scriptEl);
        window.BTSCostumePlannerInlineLoaded = true;
      } else if (typeof window.BTSCostumePlannerInit === 'function') {
        window.BTSCostumePlannerInit().then(function () { if (typeof window.showTab === 'function') window.showTab(targetCostumeTab); });
      }
    } catch (error) {
      mount.innerHTML = '<div class="dept-empty">Costume planning could not load: ' + esc(error.message) + '</div>';
    }
  }

  function renderDashboard() {
    const receipts = sectionReceipts();
    const approved = receipts.filter(function (receipt) { return receipt.status === 'approved' || receipt.status === 'paid'; });
    const cats = sectionCategories();
    const allocated = cats.reduce(function (sum, cat) { return sum + (cat.planned_cents || 0); }, 0);
    const spent = approved.reduce(function (sum, receipt) { return sum + (receipt.amount_cents || 0); }, 0);
    const remaining = Math.max(0, allocated - spent);
    const opportunities = sectionOpportunities();
    const signups = sectionSignups(opportunities);
    const vol = volunteerStats(opportunities, signups);
    return '<div class="dept-dashboard">' +
      '<div class="dept-overview-row">' +
        renderBudgetCard(allocated, spent, remaining) +
        renderVolunteersCard(vol.assigned, vol.open, vol.needed, vol.acceptedSignups) +
        renderNextUpCard(opportunities) +
      '</div>' +
      '<div class="dept-detail-row">' +
        renderActivityCard(receipts, signups, opportunities) +
        renderNotesCard() +
      '</div>' +
      renderQuickActions() +
    '</div>';
  }

  function renderBudgetCard(allocated, spent, remaining) {
    const used = percent(spent, allocated);
    return '<section class="dept-summary-card dept-summary-card--budget">' +
      '<div class="dept-summary-head"><div><div class="dept-summary-kicker">Budget</div><div class="dept-summary-title">' + esc(fmtMoney(remaining)) + '</div></div><button type="button" class="dept-card-action dark" onclick="BTSDepartmentSection.openReceiptFromDashboard()">Submit Receipt</button></div>' +
      '<div class="dept-summary-stats">' +
        statBlock('Allocated', fmtMoney(allocated)) +
        statBlock('Spent', fmtMoney(spent)) +
        statBlock('Remaining', fmtMoney(remaining), 'accent') +
      '</div>' +
      progressBar(used, state.group.color) +
      '<div class="dept-summary-note">' + used + '% of budget used</div>' +
    '</section>';
  }

  var LEAD_KEYWORDS = /\b(lead|manager|director|designer|coordinator|head|supervisor|technician|captain)\b/i;

  function signupRole(s) {
    var linked = state.opportunities.find(function (o) { return o.id === s.opportunity_id; });
    return linked ? (linked.production_title || linked.volunteer_role || linked.summary || '') : (s.role_name || s.volunteer_role || s.department || '');
  }

  function renderVolunteersCard(assigned, open, needed, acceptedSignups) {
    var filled = percent(assigned, needed);
    var all = acceptedSignups || [];
    var leads = all.filter(function (s) { return LEAD_KEYWORDS.test(signupRole(s)); });
    var crew = all.filter(function (s) { return !LEAD_KEYWORDS.test(signupRole(s)); });

    function chip(s) {
      var name = s.name || s.volunteer_name || s.email || 'Volunteer';
      var role = signupRole(s);
      return '<div class="dept-vol-chip">' +
        '<span class="dept-vol-name">' + esc(name) + '</span>' +
        (role ? '<span class="dept-vol-role">' + esc(role) + '</span>' : '') +
      '</div>';
    }

    var headHtml = '';
    if (leads.length) {
      headHtml = '<div class="dept-vol-section">' +
        '<div class="dept-vol-section-label">Department Head</div>' +
        '<div class="dept-vol-roster">' + leads.map(chip).join('') + '</div>' +
      '</div>';
    } else {
      headHtml = '<div class="dept-vol-section">' +
        '<div class="dept-vol-section-label">Department Head</div>' +
        '<div class="dept-vol-empty">No lead assigned yet</div>' +
      '</div>';
    }

    var crewHtml = crew.length
      ? '<div class="dept-vol-section"><div class="dept-vol-section-label">Volunteers</div><div class="dept-vol-roster">' + crew.map(chip).join('') + '</div></div>'
      : '';

    return '<section class="dept-summary-card dept-summary-card--volunteers">' +
      '<div class="dept-summary-head"><div><div class="dept-summary-kicker">Volunteers</div><div class="dept-summary-title">' + esc(assigned + '/' + needed) + '</div></div><button type="button" class="dept-card-action" onclick="BTSDepartmentSection.goVolunteers()">Manage Volunteers</button></div>' +
      '<div class="dept-summary-stats">' +
        statBlock('Assigned', String(assigned), 'accent') +
        statBlock('Open Positions', String(open), 'accent') +
        statBlock('Total Needed', String(needed), 'accent') +
      '</div>' +
      progressBar(filled, state.group.color) +
      '<div class="dept-summary-note">' + filled + '% of volunteer needs filled</div>' +
      '<div class="dept-brand-volunteers">' + headHtml + crewHtml + '</div>' +
    '</section>';
  }

  function renderNextUpCard(opportunities) {
    const shifts = sectionShiftRows(opportunities);
    if (!shifts.length) {
      return '<section class="dept-summary-card dept-summary-card--next">' +
        '<div class="dept-summary-head"><div><div class="dept-summary-kicker">Next Up</div><div class="dept-summary-title">Nothing Scheduled</div></div><button type="button" class="dept-card-action dark" onclick="BTSDepartmentSection.goCalendar()">Calendar</button></div>' +
        '<p class="dept-next-empty">No upcoming ' + esc(state.section.label) + ' volunteer shifts are on the schedule yet.</p>' +
      '</section>';
    }
    const firstDate = fmtDate(shifts[0].date);
    const list = shifts.map(renderNextShiftRow).join('');
    return '<section class="dept-summary-card dept-summary-card--next">' +
      '<div class="dept-summary-head"><div><div class="dept-summary-kicker">Next Up</div><div class="dept-summary-title">' + esc(shifts.length + ' Shift' + (shifts.length === 1 ? '' : 's')) + '</div><div class="dept-next-line">Starting ' + esc(firstDate) + '</div></div><button type="button" class="dept-card-action dark" onclick="BTSDepartmentSection.goCalendar()">Calendar</button></div>' +
      '<div class="dept-next-list">' + list + '</div>' +
    '</section>';
  }

  function renderNextShiftRow(shift) {
    const day = shift.date ? new Date(shift.date + 'T12:00:00') : null;
    const month = day ? day.toLocaleDateString('en-CA', { month: 'short' }).toUpperCase() : 'TBC';
    const dayNum = day ? String(day.getDate()) : '-';
    const weekday = day ? day.toLocaleDateString('en-CA', { weekday: 'short' }).toUpperCase() : '';
    const time = fmtTimeRange(shift.start, shift.end) || 'Time TBC';
    const meta = [
      time,
      shift.venue || '',
      shift.needed ? shift.needed + ' needed' : '',
    ].filter(Boolean).join(' - ');
    return '<div class="dept-next-shift">' +
      '<div class="dept-date-badge compact"><div>' + esc(month) + '</div><strong>' + esc(dayNum) + '</strong><span>' + esc(weekday) + '</span></div>' +
      '<div class="dept-next-shift-copy">' +
        '<div class="dept-next-shift-title">' + esc(shift.title || 'Volunteer Shift') + '</div>' +
        '<div class="dept-next-shift-meta">' + esc(meta) + '</div>' +
        (shift.eventTitle && shift.eventTitle !== shift.title ? '<div class="dept-next-shift-event">' + esc(shift.eventTitle) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function renderActivityCard(receipts, signups, opportunities) {
    const rows = [];
    receipts.slice(0, 5).forEach(function (receipt) {
      rows.push({
        initials: initials(receiptSubmitter(receipt)),
        color: '#ca7ea7',
        title: receiptSubmitter(receipt) + ' uploaded a receipt' + (receipt.vendor ? ' from ' + receipt.vendor : ''),
        time: receipt.created_at || receipt.receipt_date || '',
      });
    });
    signups.slice(0, 5).forEach(function (signup) {
      rows.push({
        initials: initials(signup.name || signup.volunteer_name || signup.email || 'Volunteer'),
        color: '#3f7899',
        title: (signup.name || signup.volunteer_name || signup.email || 'Volunteer') + ' joined this section',
        time: signup.updated_at || signup.created_at || '',
      });
    });
    opportunities.slice(0, 5).forEach(function (opp) {
      rows.push({
        initials: initials(opp.production_title || 'Role'),
        color: state.group.color,
        title: (opp.production_title || 'Volunteer role') + ' role updated',
        time: opp.updated_at || opp.created_at || '',
      });
    });
    rows.sort(function (a, b) { return String(b.time || '').localeCompare(String(a.time || '')); });
    return '<section class="dept-dash-card dept-activity-card">' +
      '<div class="dept-section-head"><div class="dept-dash-card-head"><span class="dept-line-icon activity" aria-hidden="true"></span><span>Recent Activity</span></div><button type="button" class="dept-card-link inline" onclick="BTSDepartmentSection.openTab(\'receipts\')">View All</button></div>' +
      (rows.length ? '<div class="dept-activity-list">' + rows.slice(0, 5).map(activityRow).join('') + '</div>' : '<div class="dept-next-empty">No recent section activity yet.</div>') +
    '</section>';
  }

  function renderNotesCard() {
    const notes = state.section.notes || [];
    return '<section class="dept-dash-card dept-notes-card">' +
      '<div class="dept-section-head"><div class="dept-dash-card-head"><span class="dept-line-icon notes" aria-hidden="true"></span><span>Department Notes</span></div><button type="button" class="dept-card-link inline" onclick="BTSDepartmentSection.openTab(\'planning\')">Edit Notes</button></div>' +
      '<ul class="dept-note-list">' + notes.map(function (note) { return '<li>' + esc(note) + '</li>'; }).join('') + '</ul>' +
    '</section>';
  }

  function renderQuickActions() {
    return '<section class="dept-dash-card dept-actions-card">' +
      '<div class="dept-dash-card-head"><span class="dept-line-icon" aria-hidden="true">!</span><span>Quick Actions</span></div>' +
      '<div class="dept-action-grid">' +
        quickAction('Manage Volunteers', 'Add, remove, or assign volunteers', state.group.color, 'BTSDepartmentSection.goVolunteers()', 'Volunteers') +
        quickAction('View Budget', 'See budget details and spending', '#769e7b', 'BTSDepartmentSection.goBudget()', 'Budget') +
        quickAction('Upload Receipt', 'Add a new receipt or expense', '#efab45', 'BTSDepartmentSection.openReceiptFromDashboard()', 'Receipts') +
        quickAction('Department Files', 'View and manage files and documents', '#476aaa', 'BTSDepartmentSection.goFiles()', 'Files') +
      '</div>' +
    '</section>';
  }

  function statBlock(label, value, tone) {
    return '<div><div class="dept-stat-label">' + esc(label) + '</div><div class="dept-stat-value ' + esc(tone || '') + '">' + esc(value) + '</div></div>';
  }

  function progressBar(value, color) {
    return '<div class="dept-progress"><span style="width:' + esc(value) + '%;background:' + esc(color) + ';"></span></div>';
  }

  function initials(value) {
    const parts = String(value || 'BTS').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || 'B') + (parts[1]?.[0] || parts[0]?.[1] || 'T');
  }

  function activityRow(row) {
    return '<div class="dept-activity-row"><div class="dept-avatar" style="background:' + esc(row.color) + ';">' + esc(initials(row.initials)) + '</div><div><div class="dept-list-title">' + esc(row.title) + '</div><div class="dept-list-meta">' + esc(relativeTime(row.time)) + '</div></div></div>';
  }

  function relativeTime(value) {
    if (!value) return 'Recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fmtDate(String(value).slice(0, 10));
    const diff = Date.now() - date.getTime();
    const day = 24 * 60 * 60 * 1000;
    if (diff < day) return 'Today';
    if (diff < day * 2) return 'Yesterday';
    return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  function quickAction(title, copy, color, action, kicker) {
    return '<button type="button" class="dept-quick-action" style="--dept-action-color:' + esc(color) + ';" onclick="' + esc(action) + '">' +
      '<span class="dept-quick-icon" aria-hidden="true"></span>' +
      '<span><span class="dept-quick-kicker">' + esc(kicker || 'Action') + '</span><strong>' + esc(title) + '</strong><small>' + esc(copy) + '</small></span>' +
      '<span class="dept-quick-arrow" aria-hidden="true">></span>' +
    '</button>';
  }

  function renderPlanningList(showTitle) {
    const items = state.section.planning || [];
    return (showTitle ? '<div class="dept-panel-sub" style="margin-bottom:0.75rem;">Use this as the section working checklist. Detailed task storage can plug into the shared task system when that data model is ready.</div>' : '') +
      '<div class="dept-list">' + items.map(function (item) {
        return '<div class="dept-list-item"><div><div class="dept-list-title">' + esc(item) + '</div><div class="dept-list-meta">' + esc(state.section.label) + ' - planning item</div></div><span class="dept-status">Plan</span></div>';
      }).join('') + '</div>';
  }

  function renderPlanning() {
    return '<section class="dept-panel">' +
      '<div class="dept-panel-head"><div><div class="dept-panel-title">' + esc(state.section.label) + ' Planning</div><div class="dept-panel-sub">Section-specific planning, without mixing this work into the parent department group.</div></div></div>' +
      renderPlanningList(true) +
    '</section>';
  }

  function renderReceiptList(receipts, includeActions) {
    if (!receipts.length) {
      return '<div class="dept-empty">No receipts are linked to ' + esc(state.section.label) + ' yet.</div>';
    }
    return '<div class="dept-list">' + receipts.map(function (receipt) {
      return '<div class="dept-list-item">' +
        '<div><div class="dept-list-title">' + esc(receiptTitle(receipt)) + ' - ' + esc(fmtMoney(receipt.amount_cents)) + '</div>' +
        '<div class="dept-list-meta">' + esc(fmtDate(receipt.receipt_date)) + ' - ' + esc(receiptSubmitter(receipt)) + (receipt.description ? ' - ' + esc(receipt.description) : '') + '</div></div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;justify-content:flex-end;flex-wrap:wrap;">' +
          '<span class="dept-status ' + esc(receipt.status || 'pending') + '">' + esc(statusLabel(receipt.status)) + '</span>' +
          (includeActions ? '<button type="button" class="dept-action secondary" onclick="BTSDepartmentSection.openReceiptModal(\'' + esc(receipt.id) + '\')">Edit</button>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderReceipts() {
    const cats = sectionCategories();
    const receipts = sectionReceipts();
    const setup = cats.length ? '' : '<div class="dept-empty">No budget category exists for ' + esc(state.section.label) + ' yet. Create one here so receipts can belong to this section instead of the parent department.</div>';
    return '<section class="dept-panel">' +
      '<div class="dept-panel-head"><div><div class="dept-panel-title">' + esc(state.section.label) + ' Receipts</div><div class="dept-panel-sub">Receipts are filtered by this section budget category.</div></div><div style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end;">' +
        (cats.length ? '<button class="dept-action" onclick="BTSDepartmentSection.openReceiptModal()">Add Receipt</button>' : '<button class="dept-action" onclick="BTSDepartmentSection.createCategory()">Create Category</button>') +
      '</div></div>' +
      setup +
      (cats.length ? renderReceiptList(receipts, true) : '') +
    '</section>';
  }

  function renderContent() {
    if (isCostumeTab()) return renderCostumePlanningMount();
    if (isReceiptFormTab()) return '<div class="dept-costume-planning-native" id="dept-receipt-form-native"><div class="dept-empty">Loading receipts...</div></div>';
    if (state.tab === 'planning') return renderPlanning();
    if (state.tab === 'receipts') return renderReceipts();
    return renderDashboard();
  }

  function render() {
    const root = document.getElementById('department-section-root');
    if (!root) return;
    document.title = state.section.label + ' - Build The Show';
    root.style.setProperty('--dept-color', state.group.color || '#572e88');
    // When switching between costume tabs, reuse the mounted planner without a full re-render
    if (isCostumeTab() && window.BTSCostumePlannerInlineLoaded && document.getElementById('dept-costume-planning-native')) {
      if (typeof window.showTab === 'function') window.showTab(activeCostumeTabKey());
      var tabsEl = document.querySelector('.dept-tabs');
      if (tabsEl) tabsEl.outerHTML = renderTabs();
      return;
    }
    root.innerHTML = renderHero() + renderTabs() + renderContent() + renderReceiptModal();
    if (isCostumeTab()) mountCostumePlanningNative();
    if (isReceiptFormTab()) mountReceiptFormNative();
  }

  async function mountReceiptFormNative() {
    var mount = document.getElementById('dept-receipt-form-native');
    if (!mount) return;
    try {
      var response = await fetch('/SYSTEM/Organisations/Productions/Workspace/department-receipt-form.html', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load receipts form');
      var html = await response.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var styleText = Array.from(doc.querySelectorAll('style')).map(function (s) { return s.textContent || ''; }).join('\n');
      var body = doc.querySelector('.department-receipts-content');
      if (!body) throw new Error('Receipt form markup was incomplete');
      var styleId = 'dept-receipt-form-style';
      if (!document.getElementById(styleId)) {
        var styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = styleText;
        document.head.appendChild(styleEl);
      }
      mount.innerHTML = '';
      var scope = document.createElement('div');
      scope.innerHTML = body.innerHTML;
      mount.appendChild(scope);

      // Build category IDs for this group using section aliases
      var groupAliases = [];
      if (state.group && state.group.sections) {
        state.group.sections.forEach(function (s) {
          [s.label].concat(s.categoryAliases || []).forEach(function (a) {
            groupAliases.push(String(a).trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' '));
          });
        });
      }
      var catIds = (state.categories || []).filter(function (c) {
        var n = String(c.name || '').trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ');
        return groupAliases.some(function (a) { return n === a || n.includes(a) || a.includes(n); });
      }).map(function (c) { return c.id; });

      // Pass all data via a global — no fragile string replacements needed
      window._RCPT_EMBED_DATA = {
        prodId: state.prodId,
        deptName: state.group ? state.group.label : 'Department',
        deptColor: (state.group && state.group.color || '#572e88').replace(/^#/, ''),
        catIds: catIds,
      };

      var scripts = Array.from(doc.querySelectorAll('script')).map(function (s) { return s.textContent || ''; }).filter(Boolean);
      var rcptScript = scripts[scripts.length - 1] || '';
      rcptScript = rcptScript.replace('window.addEventListener(\'DOMContentLoaded\', init);', 'init();');
      var scriptEl = document.createElement('script');
      scriptEl.textContent = rcptScript;
      document.body.appendChild(scriptEl);
    } catch (error) {
      mount.innerHTML = '<div class="dept-empty">Receipts could not load: ' + esc(error.message) + '</div>';
    }
  }

  function currentCategoryId() {
    const cats = sectionCategories();
    return cats[0] ? cats[0].id : '';
  }

  function renderReceiptModal() {
    const receipt = state.editingReceiptId ? state.receipts.find(function (item) { return item.id === state.editingReceiptId; }) : null;
    return '<div class="dept-modal" id="dept-receipt-modal" onclick="BTSDepartmentSection.closeModalOnBackdrop(event)">' +
      '<div class="dept-modal-card" role="dialog" aria-modal="true" aria-labelledby="dept-receipt-title">' +
        '<div class="dept-modal-head"><div class="dept-modal-title" id="dept-receipt-title">' + (receipt ? 'Edit Receipt' : 'Add Receipt') + '</div><button type="button" class="dept-close" onclick="BTSDepartmentSection.closeReceiptModal()" aria-label="Close">x</button></div>' +
        '<div class="dept-modal-body"><div class="dept-form-grid">' +
          field('Submitted By', 'dept-rec-name', 'text', receipt ? receiptSubmitter(receipt) : '', '') +
          field('Email', 'dept-rec-email', 'email', receipt ? (receipt.submitted_by_email || '') : '', '') +
          field('Date', 'dept-rec-date', 'date', receipt ? (receipt.receipt_date || '') : '', '') +
          field('Vendor', 'dept-rec-vendor', 'text', receipt ? (receipt.vendor || '') : '', '') +
          field('Amount', 'dept-rec-amount', 'number', receipt ? ((receipt.amount_cents || 0) / 100).toFixed(2) : '', '0.00') +
          '<div class="dept-field"><label>Status</label><select id="dept-rec-status"><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></div>' +
          '<div class="dept-field full"><label>Description</label><textarea id="dept-rec-desc" placeholder="What was this for?">' + esc(receipt ? (receipt.description || '') : '') + '</textarea></div>' +
          '<div class="dept-field full"><label>Notes</label><textarea id="dept-rec-notes" placeholder="Any extra context">' + esc(receipt ? (receipt.notes || '') : '') + '</textarea></div>' +
        '</div></div>' +
        '<div class="dept-modal-foot"><button type="button" class="dept-action secondary" onclick="BTSDepartmentSection.closeReceiptModal()">Cancel</button><button type="button" class="dept-action" onclick="BTSDepartmentSection.saveReceipt()">Save Receipt</button></div>' +
      '</div>' +
    '</div>';
  }

  function field(label, id, type, value, placeholder) {
    return '<div class="dept-field"><label>' + esc(label) + '</label><input id="' + esc(id) + '" type="' + esc(type) + '" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" /></div>';
  }

  function hydrateReceiptModal() {
    const receipt = state.editingReceiptId ? state.receipts.find(function (item) { return item.id === state.editingReceiptId; }) : null;
    const status = document.getElementById('dept-rec-status');
    if (status) status.value = receipt ? (receipt.status || 'pending') : 'pending';
  }

  async function createCategory() {
    const payload = {
      production_id: state.prodId,
      name: state.section.label,
      type: 'expense',
      color: state.group.color,
      planned_cents: 0,
      sort_order: 900 + config().allSections().findIndex(function (item) { return item.key === state.section.key && item.group.key === state.group.key; }),
    };
    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/budget_categories', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      await loadData();
      render();
    } catch (error) {
      alert('Could not create category: ' + error.message);
    }
  }

  function openReceiptModal(id) {
    if (!currentCategoryId()) return;
    state.editingReceiptId = id || '';
    render();
    const modal = document.getElementById('dept-receipt-modal');
    if (modal) modal.classList.add('open');
    hydrateReceiptModal();
  }

  function closeReceiptModal() {
    state.editingReceiptId = '';
    const modal = document.getElementById('dept-receipt-modal');
    if (modal) modal.classList.remove('open');
  }

  function closeModalOnBackdrop(event) {
    if (event.target && event.target.id === 'dept-receipt-modal') closeReceiptModal();
  }

  function workspaceHref(tab, sub) {
    let url = 'production-workspace.html?id=' + encodeURIComponent(state.prodId || '');
    if (tab) url += '&tab=' + encodeURIComponent(tab);
    if (sub) url += '&sub=' + encodeURIComponent(sub);
    return url;
  }

  function pageHref(file) {
    return file + '?id=' + encodeURIComponent(state.prodId || '');
  }

  function goVolunteers() {
    location.href = workspaceHref('volunteers', 'roles');
  }

  function goBudget() {
    location.href = pageHref('budget-breakdown.html');
  }

  function goCalendar() {
    location.href = workspaceHref('calendar');
  }

  function goFiles() {
    location.href = pageHref('plan-files.html');
  }

  async function openReceiptFromDashboard() {
    if (!currentCategoryId()) {
      await createCategory();
    }
    openReceiptModal();
  }

  async function saveReceipt() {
    const categoryId = currentCategoryId();
    if (!categoryId) return;
    const amount = Math.round((parseFloat(document.getElementById('dept-rec-amount').value) || 0) * 100);
    const status = document.getElementById('dept-rec-status').value || 'pending';
    const payload = {
      production_id: state.prodId,
      category_id: categoryId,
      submitted_by_name: document.getElementById('dept-rec-name').value.trim() || null,
      submitted_by_email: document.getElementById('dept-rec-email').value.trim() || null,
      receipt_date: document.getElementById('dept-rec-date').value || null,
      vendor: document.getElementById('dept-rec-vendor').value.trim() || null,
      amount_cents: amount,
      description: document.getElementById('dept-rec-desc').value.trim() || null,
      notes: document.getElementById('dept-rec-notes').value.trim() || null,
      status: status,
    };
    if (!payload.vendor && !payload.description) {
      alert('Add a vendor or description.');
      return;
    }
    try {
      const id = state.editingReceiptId;
      const response = await fetch(SUPABASE_URL + '/rest/v1/budget_receipts' + (id ? '?id=eq.' + encodeURIComponent(id) : ''), {
        method: id ? 'PATCH' : 'POST',
        headers: headers(true),
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());
      state.editingReceiptId = '';
      await loadData();
      render();
    } catch (error) {
      alert('Could not save receipt: ' + error.message);
    }
  }

  async function init() {
    const p = params();
    state.prodId = p.get('id') || '';
    const groupKey = p.get('group') || 'front-of-house';
    state.group = config().findGroup(groupKey);
    state.section = config().findSection(state.group.key, p.get('section') || '');
    var requestedTab = p.get('tab') === 'costume-plan' ? 'costume-planning' : p.get('tab');
    state.tab = (activeTabs().some(function (tab) { return tab.key === requestedTab; }) ? requestedTab : 'dashboard');
    await loadData();
    render();
    setRoute(state.tab);
  }

  window.BTSDepartmentSection = {
    init,
    openTab: setRoute,
    createCategory,
    openReceiptModal,
    closeReceiptModal,
    closeModalOnBackdrop,
    saveReceipt,
    openReceiptFromDashboard,
    goVolunteers,
    goBudget,
    goCalendar,
    goFiles,
  };
})();

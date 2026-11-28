/* Build The Show shared time display rule.
 * All displayed times use h:mmam / h:mmpm. Ranges use " - ".
 */
(function (global) {
  'use strict';

  function fromClock(value) {
    const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    const suffix = match[3]?.toLowerCase();
    const normalizedHour = suffix ? (hour % 12) + (suffix === 'pm' ? 12 : 0) : hour;
    return { hour: normalizedHour, minute };
  }

  function format(value, options = {}) {
    if (value == null || value === '') return '';
    let hour, minute;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return '';
      hour = options.timeZone === 'UTC' ? value.getUTCHours() : value.getHours();
      minute = options.timeZone === 'UTC' ? value.getUTCMinutes() : value.getMinutes();
    } else {
      const clock = fromClock(value);
      if (clock) ({ hour, minute } = clock);
      else {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        hour = options.timeZone === 'UTC' ? date.getUTCHours() : date.getHours();
        minute = options.timeZone === 'UTC' ? date.getUTCMinutes() : date.getMinutes();
      }
    }
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')}${hour >= 12 ? 'pm' : 'am'}`;
  }

  function range(start, end, options = {}) {
    const first = format(start, options);
    const last = format(end, options);
    return first && last ? `${first} - ${last}` : first || last;
  }

  function dateTime(value, dateOptions = { dateStyle: 'medium' }) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.toLocaleDateString('en-CA', dateOptions)} at ${format(date)}`;
  }

  global.BTSFormatTime = format;
  global.BTSFormatTimeRange = range;
  global.BTSFormatDateTime = dateTime;
})(window);

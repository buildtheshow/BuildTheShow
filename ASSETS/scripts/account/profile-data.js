// Extend the existing profiles.sections record without dropping older fields.
export const clone = value => JSON.parse(JSON.stringify(value ?? {}));
export function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}
export function writePath(object, path, value) {
  const keys = path.split('.');
  if (keys.some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) throw new Error('This saved field could not be updated.');
  const last = keys.pop();
  let target = object;
  for (const key of keys) {
    if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
    target = target[key];
  }
  target[last] = value;
}
export function safeMediaLink(value) {
  if (!value?.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new Error('Use a full https:// link for media and portfolios.'); }
}
export function collectProfile(record, values, histories) {
  const update = { sections: clone(record.sections) };
  for (const [path, raw] of Object.entries(values)) {
    const value = path.endsWith('_url') || path.endsWith('.media_url') ? safeMediaLink(raw) : raw;
    if (path.startsWith('sections.')) writePath(update, path, value);
    else if (['credit_name', 'nickname', 'pronouns', 'bio'].includes(path)) update[path] = value;
  }
  for (const key of ['volunteer', 'creative']) {
    const rows = (histories[key] || []).map(row => {
      const clean = {};
      for (const field of ['title', 'organisation', 'role', 'year', ...(key === 'volunteer' ? ['description'] : [])]) {
        clean[field] = String(row[field] ?? '').trim();
      }
      return clean;
    }).filter(row => Object.values(row).some(Boolean));
    if (rows.length > 100) throw new Error('Keep up to 100 productions in each history.');
    if (rows.some(row => !row.title || !row.role)) throw new Error('Add a production title and role to each history entry, or remove the empty entry.');
    writePath(update, 'sections.' + key + '.history', rows);
  }
  return update;
}
export function validateUpload(file, kind) {
  if (!file || file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('Choose a file under 5 MB.');
  const types = kind === 'photo' ? {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'} : {'application/pdf':'pdf'};
  if (!types[file.type]) throw new Error(kind === 'photo' ? 'Choose a JPG, PNG or WebP photo.' : 'Choose a PDF for your Resume / CV.');
  return types[file.type];
}
export const ROLE_KEYS = ['performer', 'volunteer', 'creative'];

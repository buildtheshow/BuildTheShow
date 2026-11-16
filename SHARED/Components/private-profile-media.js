/* Canonical file URLs stay in records; short-lived authorised links stay in this page. */
const HOST = 'tkmaiktxpwqfbgeojbnf.supabase.co';
const PRIVATE_BUCKETS = new Set(['profile-headshots','audition-headshots','production-files','org-files','receipts','proposal-attachments','programme-ads','venue-photos']);
const cache = new Map();
const pending = new WeakMap();
let clientPromise;
function privateFile(value) {
  if (!value) return null;
  try {
    const url = new URL(value, location.origin);
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (url.hostname !== HOST || !match || !PRIVATE_BUCKETS.has(match[1])) return null;
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch { return null; }
}
async function authorisedUrl(value) {
  const file = privateFile(value);
  if (!file) return value;
  const key = file.bucket + '/' + file.path;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.url;
  clientPromise ||= import('/ASSETS/scripts/supabase.js').then(module => module.supabase);
  const client = await clientPromise;
  const { data, error } = await client.storage.from(file.bucket).createSignedUrl(file.path, 300);
  if (error || !data?.signedUrl) throw new Error('Your account does not have access to this private file.');
  cache.set(key, { url: data.signedUrl, expires: Date.now() + 240000 });
  return data.signedUrl;
}
async function resolve(element, attribute) {
  const original = element.getAttribute(attribute);
  if (!privateFile(original) || pending.get(element) === original) return;
  pending.set(element, original);
  try {
    const url = await authorisedUrl(original);
    if (element.getAttribute(attribute) === original) element.setAttribute(attribute, url);
  } catch {
    if (element.getAttribute(attribute) !== original) return;
    if (element.tagName === 'IMG') element.hidden = true;
    else { element.removeAttribute(attribute); element.title = 'Sign in with an authorised account to view this private file.'; }
  } finally { pending.delete(element); }
}
function inspect(node) {
  if (!(node instanceof Element)) return;
  for (const attribute of ['src','href','data']) {
    if (node.hasAttribute(attribute)) resolve(node, attribute);
    node.querySelectorAll('[' + attribute + ']').forEach(element => resolve(element, attribute));
  }
}
const observer = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'attributes') inspect(record.target);
    else record.addedNodes.forEach(inspect);
  }
});
observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['src','href','data'] });
inspect(document.documentElement);
// Downloads made with fetch need the same permission check as displayed links.
const originalFetch = window.fetch.bind(window);
window.fetch = async function (input, options) {
  const value = typeof input === 'string' || input instanceof URL ? String(input) : null;
  return originalFetch(value && privateFile(value) ? await authorisedUrl(value) : input, options);
};
const originalOpen = window.open.bind(window);
function openFile(value, target, features) {
  if (!privateFile(value)) return originalOpen(value, target, features);
  const popup = originalOpen('', target || '_blank', features);
  if (popup) popup.opener = null;
  authorisedUrl(value).then(url => {
    if (popup) popup.location.replace(url);
    else originalOpen(url, target || '_blank', features);
  }).catch(() => {
    if (popup) popup.close();
    alert('Your account does not have access to this private file.');
  });
  return popup;
}
window.BTSPrivateMedia = { authorisedUrl, open:openFile };

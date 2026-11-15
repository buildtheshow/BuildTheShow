/* Profile files stay private. Signed links are used only in the current page. */
const PREFIX = '/storage/v1/object/public/profile-headshots/';
const HOST = 'tkmaiktxpwqfbgeojbnf.supabase.co';
const cache = new Map();
const pending = new WeakMap();
let clientPromise;
function privatePath(value) {
  if (!value) return null;
  try {
    const url = new URL(value, location.origin);
    if (url.hostname !== HOST || !url.pathname.startsWith(PREFIX)) return null;
    return decodeURIComponent(url.pathname.slice(PREFIX.length));
  } catch { return null; }
}
async function signedUrl(path) {
  const cached = cache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  clientPromise ||= import('/ASSETS/scripts/supabase.js').then(module => module.supabase);
  const client = await clientPromise;
  const { data, error } = await client.storage.from('profile-headshots').createSignedUrl(path, 900);
  if (error || !data?.signedUrl) throw new Error('This profile file is private.');
  cache.set(path, { url: data.signedUrl, expires: Date.now() + 840000 });
  return data.signedUrl;
}
async function resolve(element) {
  const attribute = element.tagName === 'A' ? 'href' : 'src';
  const original = element.getAttribute(attribute);
  const path = privatePath(original);
  if (!path || pending.get(element) === original) return;
  pending.set(element, original);
  try {
    const url = await signedUrl(path);
    if (element.getAttribute(attribute) === original) element.setAttribute(attribute, url);
  } catch {
    if (element.getAttribute(attribute) !== original) return;
    if (element.tagName === 'IMG') { element.hidden = true; }
    else { element.removeAttribute('href'); element.title = 'Sign in to view this private profile file.'; }
  } finally { pending.delete(element); }
}
function inspect(node) {
  if (!(node instanceof Element)) return;
  if (node.matches('img[src],a[href]')) resolve(node);
  node.querySelectorAll('img[src],a[href]').forEach(resolve);
}
const observer = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'attributes') inspect(record.target);
    else record.addedNodes.forEach(inspect);
  }
});
observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['src','href'] });
inspect(document.documentElement);

// Uploaded media lives on the API host (/uploads/...) in development and on
// the CDN in production. This resolves a stored URL to something displayable.
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const apiOrigin = apiBase.replace(/\/api\/v1\/?$/, '');

export function mediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('/uploads/')) return `${apiOrigin}${url}`;
  return url;
}

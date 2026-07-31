// Timestamps are stored in UTC on the server; formatting here uses the viewer's
// own locale + timezone (native Intl), so a hosted deployment shows every user
// their OWN local date/time — no library needed (Intl already does this; moment
// is deprecated). British-style formatting to match the rest of the app.

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

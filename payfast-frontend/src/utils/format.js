export function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export const titleCase = (text = '') => text.charAt(0).toUpperCase() + text.slice(1);

// Event times are stored as a UTC-pinned wall clock: the time the organizer typed is the time
// every viewer sees, and the same instant the ?date= filter matches. Rendering must therefore
// pin UTC as well -- a plain toLocaleString() would shift the time into the viewer's zone and
// disagree with the filter. That is why this lives in one module instead of being inlined.
const EVENT_DATE_FORMAT = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' };

export function formatEventDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', EVENT_DATE_FORMAT);
}

// Turns a stored timestamp back into a datetime-local input value, in UTC so the edit form
// shows the same wall clock that was submitted.
export function toDateTimeInputValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

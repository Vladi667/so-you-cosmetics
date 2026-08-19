// Shop settings she controls from the admin: opening hours, an absence notice,
// and maintenance mode. Injected into the page by the server before it is sent
// (see server/index.js), exactly like the content overrides — so they are read
// synchronously and there is no moment where the old hours are on screen.
//
// Every accessor tolerates the value being absent: if the injection ever fails,
// the site falls back to what it showed before this existed rather than to a
// blank panel.
const shop = (typeof window !== 'undefined' && window.__SHOP__) || {};

// The hours the site displayed when they were hard-coded, kept as the floor.
const DEFAULT_HOURS = [
  { day: 'lundi', closed: true, hours: '' },
  { day: 'mardi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
  { day: 'mercredi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
  { day: 'jeudi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
  { day: 'vendredi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
  { day: 'samedi', closed: false, hours: '11:00–16:30' },
];

export function getHours() {
  return Array.isArray(shop.hours) && shop.hours.length > 0 ? shop.hours : DEFAULT_HOURS;
}

// The notice she puts up when she is away — typically about dispatch delays.
// Returns null unless she has both switched it on and written something in the
// current language (or in French, which every language falls back to).
export function getAbsenceNotice(language) {
  const a = shop.absence;
  if (!a || !a.active) return null;
  const text = a[language] || a.fr;
  return text ? String(text) : null;
}

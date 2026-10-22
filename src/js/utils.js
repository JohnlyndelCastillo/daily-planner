import { getTasksByDate, getAllDates } from './storage.js';

export function fmt(time) {
  const d = new Date(time);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function autoResize(el) {
  el.style.height = 'auto';
  void el.offsetHeight;
  el.style.height = el.scrollHeight + 'px';
}

export function checkCarryOver() {
  const todayKey = new Date().toISOString().split('T')[0];
  const seenKey = `carryover-seen-${todayKey}`;

  // Don't show banner if already seen today
  if (localStorage.getItem(seenKey)) return;

  const unfinished = getAllDates()
    .filter(key => key < todayKey)
    .flatMap(key =>
      getTasksByDate(key)
        .filter(t => t.status !== 'done')
        .filter(t => !t.carriedOver)
        .map(t => ({ ...t, sourceDate: key })) // ← key must be captured per iteration
    );

  if (unfinished.length > 0) {
    // Kept for callers from the previous version. The current UI renders carry-over actions inline.
    globalThis.showCarryOverBanner?.(unfinished);
  }
}

export function rotatePlaceholder(el, phrases, intervalMs = 15000) {
  let current = 0;
  el.placeholder = phrases[current];

  setInterval(() => {
    el.classList.add('fading');

    setTimeout(() => {
      current = (current + 1) % phrases.length;
      el.placeholder = phrases[current];
      el.classList.remove('fading');
    }, 400);
  }, intervalMs);
}

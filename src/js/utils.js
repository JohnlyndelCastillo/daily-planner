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
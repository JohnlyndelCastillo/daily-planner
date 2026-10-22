const ESTIMATE = /^~(?:(\d+)h(?:(\d+)m)?|(\d+)m)$/i;

function parseTime(token) {
  const twentyFourHour = /^@(\d{1,2}):(\d{2})$/i.exec(token);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (hour < 24 && minute < 60) return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return null;
  }
  const meridiem = /^@(\d{1,2})(?::(\d{2}))?(am|pm)$/i.exec(token);
  if (meridiem) {
    const rawHour = Number(meridiem[1]);
    const minute = Number(meridiem[2] || 0);
    if (rawHour < 1 || rawHour > 12 || minute > 59) return null;
    const hour = (rawHour % 12) + (meridiem[3].toLowerCase() === 'pm' ? 12 : 0);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  return null;
}

function parseEstimate(token) {
  const match = ESTIMATE.exec(token);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const standaloneMinutes = Number(match[3] || 0);
  const total = hours * 60 + minutes + standaloneMinutes;
  return total > 0 ? total : null;
}

export function parseQuickAdd(input = '') {
  const fields = { title: '', tag: null, estimateMin: null, priority: 'normal', blockStart: null, blockEnd: null };
  const keptLines = String(input).split(/\r?\n/u).map(line => {
    const kept = [];
    line.split(/[ \t]+/u).filter(Boolean).forEach(token => {
      const tagToken = /^#([\p{L}\p{N}_-]+)$/u.exec(token);
      if (tagToken) {
        if (!fields.tag) fields.tag = tagToken[1].toLowerCase();
        return;
      }
      const estimate = parseEstimate(token);
      if (estimate) {
        if (!fields.estimateMin) fields.estimateMin = estimate;
        return;
      }
      if (/^!(high|top)$/i.test(token)) {
        if (fields.priority === 'normal') fields.priority = token.toLowerCase() === '!top' ? 'top' : 'high';
        return;
      }
      if (token.startsWith('@')) {
        const start = parseTime(token);
        if (start) {
          if (!fields.blockStart) fields.blockStart = start;
          return;
        }
      }
      kept.push(token);
    });
    return kept.join(' ');
  });

  fields.title = keptLines.join('\n').trim();
  if (fields.blockStart) {
    const [hour, minute] = fields.blockStart.split(':').map(Number);
    const end = Math.min(23 * 60 + 59, hour * 60 + minute + (fields.estimateMin || 30));
    fields.blockEnd = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  }
  return fields;
}

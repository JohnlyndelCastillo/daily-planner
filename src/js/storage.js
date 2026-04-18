const todayKey = new Date().toISOString().split('T')[0];

export function getTasks() {
  try {
    return JSON.parse(localStorage.getItem(todayKey)) || [];
  } catch {
    return [];
  }
}

export function getTasksByDate(dateKey) {
  try { return JSON.parse(localStorage.getItem(dateKey)) || []; }
  catch { return []; }
}

export function saveTasks(tasks) {
  localStorage.setItem(todayKey, JSON.stringify(tasks));
}

export function getAllDates() {
  return Object.keys(localStorage).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
}
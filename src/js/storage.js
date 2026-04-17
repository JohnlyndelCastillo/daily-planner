const todayKey = new Date().toISOString().split('T')[0];

export function getTasks() {
  try {
    return JSON.parse(localStorage.getItem(todayKey)) || [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(todayKey, JSON.stringify(tasks));
}
import { getAllTasksSync } from './storage.js';
import { localDayKey } from './tasks.js';

export function startOfWeek(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
}

export function addDays(date, count) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + count);
  return result;
}

export function getWeeklySummary(referenceDate = new Date()) {
  const monday = startOfWeek(referenceDate);
  const tasks = getAllTasksSync();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const key = localDayKey(date);
    const dayTasks = tasks.filter(task => task.day === key);
    return {
      key,
      isToday: key === localDayKey(new Date()),
      tasks: dayTasks.length,
      completed: dayTasks.filter(task => task.status === 'done').length,
      focusMinutes: dayTasks.reduce((total, task) => total + (task.focusMinutes || 0), 0),
    };
  });
  const totalTasks = days.reduce((sum, day) => sum + day.tasks, 0);
  const totalCompleted = days.reduce((sum, day) => sum + day.completed, 0);
  return {
    startDate: localDayKey(monday),
    endDate: localDayKey(addDays(monday, 6)),
    days,
    totalTasks,
    totalCompleted,
    totalFocusMinutes: days.reduce((total, day) => total + day.focusMinutes, 0),
    completionRate: totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100),
  };
}

import { getTasksByDate } from './storage.js';

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function getWeeklySummary(referenceDate = new Date()) {
  const today = new Date(`${dateKey(referenceDate)}T00:00:00.000Z`);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    const key = dateKey(date);
    const tasks = getTasksByDate(key);
    const completed = tasks.filter(task => task.status === 'done').length;

    return {
      key,
      isToday: key === dateKey(today),
      tasks: tasks.length,
      completed,
    };
  });

  const totalTasks = days.reduce((sum, day) => sum + day.tasks, 0);
  const totalCompleted = days.reduce((sum, day) => sum + day.completed, 0);

  return {
    startDate: days[0].key,
    endDate: days[6].key,
    days,
    totalTasks,
    totalCompleted,
    completionRate: totalTasks === 0 ? 0 : Math.round((totalCompleted / totalTasks) * 100),
  };
}

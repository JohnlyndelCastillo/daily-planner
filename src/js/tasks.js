import { getTasks, saveTasks } from './storage.js';

export const STATUS = {
  todo: { icon: '🌿', label: 'To Do', pill: 'bg-emerald-100 text-emerald-700' },
  doing: { icon: '⚡', label: 'Doing', pill: 'bg-sky-100 text-sky-600' },
  done: { icon: '🌸', label: 'Done', pill: 'bg-pink-100 text-pink-600' },
};

export function addTask(text) {
  const tasks = getTasks();
  tasks.push({ text, status: 'todo', startTime: null, endTime: null });
  saveTasks(tasks);
}

export function startTask(i) {
  const tasks = getTasks();
  if (!tasks[i].startTime) tasks[i].startTime = new Date().toISOString();
  tasks[i].status = 'doing';
  saveTasks(tasks);
}

export function markDone(i) {
  const tasks = getTasks();
  if (!tasks[i].startTime) tasks[i].startTime = new Date().toISOString();
  tasks[i].status = 'done';
  tasks[i].endTime = new Date().toISOString();
  saveTasks(tasks);
}

export function deleteTask(i) {
  const tasks = getTasks();
  tasks.splice(i, 1);
  saveTasks(tasks);
}
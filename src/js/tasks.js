import { getTasks, saveTasks } from './storage.js';

export const STATUS = {
  todo: { icon: '<circle cx="12" cy="12" r="8"/>', label: 'To Do', pill: 'bg-emerald-100 text-emerald-700' },
  doing: { icon: '<circle cx="12" cy="12" r="8"/><path d="m10 8 5 4-5 4z"/>', label: 'Doing', pill: 'bg-sky-100 text-sky-600' },
  done: { icon: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/>', label: 'Done', pill: 'bg-pink-100 text-pink-600' },
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

export function carryOverTask(task) {
  const today = getTasks();
  today.push({
    ...task,
    status: 'todo',       // reset to todo
    startTime: null,      // clear times
    endTime: null,
    carriedOver: true,    // flag to indicate it's a carry-over task
    carriedFrom: task.sourceDate ?? task.carriedFrom,

  });
  saveTasks(today);
}

export function editTask(i, newText) {
  const tasks = getTasks();
  if (!newText.trim()) return;
  tasks[i].text = newText.trim();
  saveTasks(tasks);
}

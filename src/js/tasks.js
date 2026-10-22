import { getTasks, saveTasks, getTasksByDay, getTask, getAllTasks, putTask, deleteTask as deleteStoredTask } from './storage.js';

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

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function plannerTask(fields, day, order) {
  const now = Date.now();
  return {
    id: globalThis.crypto?.randomUUID?.() || `task-${now}-${Math.random().toString(36).slice(2)}`,
    title: String(fields.title || '').trim(),
    day,
    status: 'todo',
    priority: ['normal', 'high', 'top'].includes(fields.priority) ? fields.priority : 'normal',
    tag: fields.tag || null,
    estimateMin: Number.isFinite(fields.estimateMin) && fields.estimateMin > 0 ? fields.estimateMin : null,
    blockStart: fields.blockStart || null,
    blockEnd: fields.blockEnd || null,
    createdAt: now,
    startedAt: null,
    doneAt: null,
    focusMinutes: 0,
    carriedFrom: fields.carriedFrom || null,
    order,
    updatedAt: now,
  };
}

export async function addPlannerTask(fields, day = localDayKey()) {
  if (!String(fields.title || '').trim()) return null;
  const tasks = await getTasksByDay(day);
  return putTask(plannerTask(fields, day, tasks.length));
}

export async function setPlannerTaskStatus(id, nextStatus = null) {
  const task = await getTask(id);
  if (!task) return null;
  const order = ['todo', 'doing', 'done'];
  const status = nextStatus || order[(order.indexOf(task.status) + 1) % order.length];
  const now = Date.now();
  const updated = {
    ...task,
    status,
    startedAt: status !== 'todo' ? (task.startedAt || now) : task.startedAt,
    doneAt: status === 'done' ? now : null,
    updatedAt: now,
  };
  return putTask(updated);
}

export async function editPlannerTask(id, title) {
  const task = await getTask(id);
  const nextTitle = String(title || '').trim();
  if (!task || !nextTitle) return null;
  if (task.carriedFrom && nextTitle !== task.title) await suppressCarriedTitle(task);
  return putTask({ ...task, title: nextTitle, updatedAt: Date.now() });
}

export async function updatePlannerTask(id, changes) {
  const task = await getTask(id);
  const title = String(changes.title || '').trim();
  if (!task || !title) return null;
  if (task.carriedFrom && title !== task.title) await suppressCarriedTitle(task);
  const day = changes.day || task.day;
  const order = day === task.day ? task.order : (await getTasksByDay(day))
    .reduce((nextOrder, entry) => Math.max(nextOrder, entry.order + 1), 0);
  return putTask({
    ...task,
    title,
    day,
    order,
    priority: ['normal', 'high', 'top'].includes(changes.priority) ? changes.priority : task.priority,
    tag: changes.tag || null,
    estimateMin: Number.isFinite(changes.estimateMin) && changes.estimateMin > 0 ? changes.estimateMin : null,
    blockStart: changes.blockStart || null,
    blockEnd: changes.blockStart ? (changes.blockEnd || null) : null,
    updatedAt: Date.now(),
  });
}

async function suppressCarriedTitle(task) {
  const origin = task.carriedFrom;
  const relatedSources = (await getAllTasks()).filter(entry => (entry.carriedFrom || entry.day) === origin && entry.title === task.title);
  for (const source of relatedSources) {
    if (!source.carryDropped) await putTask({ ...source, carryDropped: true, updatedAt: Date.now() });
  }
}

export async function removePlannerTask(id) { return deleteStoredTask(id); }

export async function carryPlannerTask(task, day = localDayKey()) {
  const tasks = await getTasksByDay(day);
  const copy = plannerTask({
    ...task,
    title: task.title,
    priority: task.priority,
    tag: task.tag,
    estimateMin: task.estimateMin,
    blockStart: null,
    blockEnd: null,
    carriedFrom: task.carriedFrom || task.day,
  }, day, tasks.length);
  return putTask(copy);
}

export async function movePlannerTask(id, day) {
  const task = await getTask(id);
  if (!task) return null;
  const dayTasks = await getTasksByDay(day);
  return putTask({ ...task, day, order: dayTasks.length, updatedAt: Date.now() });
}

export async function addFocusMinutes(id, minutes) {
  const task = await getTask(id);
  if (!task) return null;
  return putTask({ ...task, focusMinutes: task.focusMinutes + minutes, updatedAt: Date.now() });
}

export async function getAllPlannerTasks() { return getAllTasks(); }

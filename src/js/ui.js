import {
  exportAll, getAllTasks, getSettings, getStorageMode, getTask, getWeek, importAll,
  putTask, requestPersistentStorage, saveSettings, saveWeek, validateBackup,
} from './storage.js';
import {
  addFocusMinutes, addPlannerTask, carryPlannerTask, editPlannerTask, localDayKey,
  movePlannerTask, removePlannerTask, setPlannerTaskStatus, updatePlannerTask,
} from './tasks.js';
import { parseQuickAdd } from './quickAdd.js';
import { addDays, startOfWeek } from './weeklySummary.js';

const STATUS_LABELS = { todo: 'To Do', doing: 'Doing', done: 'Done' };
const VIEW_TITLES = { today: 'Today', week: 'Week', blocks: 'Blocks', data: 'Data' };

let appSettings;
let currentView = 'today';
let activeWeekOffset = 0;
let toastTimer;
let reflectionTimer;
let focusTimer;
let focusSession = null;
let importCandidate = null;
let selectedPriority = 'normal';
let selectedTag = null;
let selectedDayMode = 'today';
let selectedDate = localDayKey();
let priorityManuallySet = false;
let tagManuallySet = false;
let timeManuallySet = false;
let estimateManuallySet = false;
let editingTaskId = null;
let desktopQuickSeed = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function formatDateKey(key, options = { month: 'short', day: 'numeric' }) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], options);
}

function formatTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
}

function minutesOfTime(value) {
  const [hours, minutes] = (value || '00:00').split(':').map(Number);
  return (hours * 60) + minutes;
}

function timeFromMinutes(value) {
  const safe = Math.max(0, Math.min(value, 23 * 60 + 59));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function durationLabel(minutes) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

function showToast(message) {
  const toast = $('#statusMessage');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

async function run(action, successMessage = '') {
  try {
    const result = await action();
    if (successMessage) showToast(successMessage);
    return result;
  } catch (error) {
    showToast(error?.message || 'Your change is available for this session but could not be saved.');
    return null;
  }
}

async function updateSettings(fields) {
  const updated = await run(() => saveSettings(fields));
  appSettings = updated || await getSettings();
  return appSettings;
}

function openDialog(dialog, modal = true) {
  if (dialog && !dialog.open) {
    if (modal) dialog.showModal();
    else dialog.show();
  }
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog?.open) dialog.close();
}

function setView(view) {
  if (!VIEW_TITLES[view]) return;
  currentView = view;
  document.body.dataset.currentView = view;
  $('.app-header').dataset.view = view;
  $$('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
  $$('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#viewTitle').textContent = VIEW_TITLES[view];
  if (view === 'today') renderAll();
}

function statusIcon(status) {
  if (status === 'done') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16.5 9"></path></svg>';
  if (status === 'doing') return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m10 8 6 4-6 4z"></path></svg>';
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle></svg>';
}

function topTasksFor(dayTasks) { return dayTasks.filter(task => task.priority === 'top').sort((a, b) => a.order - b.order); }
function statusText(status) { return STATUS_LABELS[status] || STATUS_LABELS.todo; }

function beginInlineEdit(task, titleElement) {
  if (task.status === 'done') return;
  const editor = document.createElement('textarea');
  editor.className = 'task-title task-editor';
  editor.value = task.title;
  editor.rows = Math.max(1, task.title.split('\n').length);
  let finished = false;
  const finish = async save => {
    if (finished) return;
    finished = true;
    if (save) await run(() => editPlannerTask(task.id, editor.value));
    await renderAll();
  };
  editor.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); finish(true); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
  editor.addEventListener('blur', () => finish(true));
  titleElement.replaceWith(editor);
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);
}

function makeTaskRow(task, options = {}) {
  const item = document.createElement('li');
  item.className = 'task-row';
  item.draggable = Boolean(options.draggable);
  item.dataset.taskId = task.id;
  if (options.draggable) item.addEventListener('dragstart', event => {
    event.dataTransfer?.setData('text/plain', task.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });

  const cycle = document.createElement('button');
  cycle.type = 'button';
  cycle.className = `status-cycle status-${task.status}`;
  cycle.setAttribute('aria-label', `Mark “${task.title}” as ${task.status === 'todo' ? 'doing' : task.status === 'doing' ? 'done' : 'to do'}`);
  cycle.title = `Status: ${statusText(task.status)}. Activate to change.`;
  cycle.innerHTML = statusIcon(task.status);
  cycle.addEventListener('click', async () => {
    await run(() => setPlannerTaskStatus(task.id));
    await renderAll();
  });

  const main = document.createElement('div');
  main.className = 'task-main';
  const title = document.createElement('span');
  title.className = `task-title${task.status === 'done' ? ' completed' : ' editable'}`;
  title.textContent = task.title;
  title.title = task.status === 'done' ? '' : 'Double-click to edit';
  title.addEventListener('dblclick', () => beginInlineEdit(task, title));
  let lastTouch = 0;
  title.addEventListener('touchend', event => {
    const now = Date.now();
    if (now - lastTouch < 360) { event.preventDefault(); beginInlineEdit(task, title); }
    lastTouch = now;
  }, { passive: false });
  main.appendChild(title);
  const detail = document.createElement('div');
  detail.className = 'task-detail';
  if (task.tag) {
    const tag = document.createElement('span');
    tag.className = 'tag-chip';
    tag.textContent = `#${task.tag}`;
    detail.appendChild(tag);
  }
  if (task.priority === 'top') {
    const top = document.createElement('span');
    top.className = 'priority-chip';
    top.textContent = 'Top 3';
    detail.appendChild(top);
  } else if (task.priority === 'high') {
    const high = document.createElement('span');
    high.className = 'priority-chip';
    high.textContent = 'High';
    detail.appendChild(high);
  }
  if (task.carriedFrom) {
    const carry = document.createElement('span');
    carry.className = 'muted';
    carry.textContent = `From ${formatDateKey(task.carriedFrom)}`;
    detail.appendChild(carry);
  }
  if (detail.childElementCount) main.appendChild(detail);

  const side = document.createElement('div');
  side.className = 'task-side';
  if (task.estimateMin) {
    const estimate = document.createElement('span');
    estimate.textContent = durationLabel(task.estimateMin);
    side.appendChild(estimate);
  }
  const status = document.createElement('span');
  status.textContent = statusText(task.status);
  side.appendChild(status);

  const menu = document.createElement('details');
  menu.className = 'task-menu';
  menu.addEventListener('toggle', () => {
    const opensUp = menu.open && window.innerHeight - menu.getBoundingClientRect().bottom < 190;
    menu.classList.toggle('opens-up', opensUp);
  });
  const summary = document.createElement('summary');
  summary.setAttribute('aria-label', `Options for ${task.title}`);
  summary.textContent = '•••';
  const menuItems = document.createElement('div');
  menuItems.className = 'menu-items';
  if (task.status !== 'done') {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit details';
    edit.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      menu.open = false;
      openEditTask(task);
    });
    menuItems.appendChild(edit);
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.textContent = 'Focus';
    focus.addEventListener('click', () => { menu.open = false; startFocus(task); });
    menuItems.appendChild(focus);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-action';
  remove.textContent = 'Remove';
  remove.addEventListener('click', async () => {
    menu.open = false;
    if (confirm('Remove this task?')) {
      if (task.carriedFrom && !(await dismissCarryOver(task))) return;
      await run(() => removePlannerTask(task.id));
      await renderAll();
    }
  });
  menuItems.appendChild(remove);
  menu.append(summary, menuItems);

  item.append(cycle, main, side, menu);
  return item;
}

function getCarryCandidates(allTasks, todayTasks) {
  const carriedOrigins = new Set(allTasks.filter(task => task.carriedFrom)
    .map(task => `${task.carriedFrom}\u0000${task.title}`));
  const dismissedOrigins = new Set(allTasks.filter(task => task.carryDropped)
    .map(task => `${task.carriedFrom || task.day}\u0000${task.title}`));
  const candidates = new Map();
  allTasks.filter(task => task.day < localDayKey() && task.status !== 'done' && !task.carryDropped)
    .forEach(task => {
      const key = `${task.carriedFrom || task.day}\u0000${task.title}`;
      if (carriedOrigins.has(key) || dismissedOrigins.has(key)) return;
      const previous = candidates.get(key);
      if (!previous || task.day > previous.day) candidates.set(key, task);
    });
  return [...candidates.values()];
}

async function dismissCarryOver(task) {
  const origin = task.carriedFrom || task.day;
  const allTasks = await getAllTasks();
  const related = allTasks.filter(entry => (entry.carriedFrom || entry.day) === origin && entry.title === task.title);
  for (const entry of related) {
    if (!entry.carryDropped && !(await run(() => putTask({ ...entry, carryDropped: true, updatedAt: Date.now() })))) return false;
  }
  return true;
}

function renderToday(allTasks) {
  const today = localDayKey();
  const tasks = allTasks.filter(task => task.day === today).sort((a, b) => a.order - b.order);
  const top = topTasksFor(tasks);
  const later = tasks.filter(task => task.priority !== 'top').sort((a, b) => a.order - b.order);
  const done = tasks.filter(task => task.status === 'done').length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const plannedMin = tasks.reduce((total, task) => total + (task.estimateMin || (task.blockStart ? 30 : 0)), 0);
  const freeMinutes = Number(appSettings.freeHoursPerDay || 6) * 60;
  const capacityPercent = freeMinutes ? Math.min(100, Math.round((plannedMin / freeMinutes) * 100)) : 0;
  const todayLabelDate = new Date();
  $('.desktop-date').textContent = todayLabelDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  $('.mobile-date').textContent = todayLabelDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
  $('#blocksDateLabel').textContent = todayLabelDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
  $('#taskCount').textContent = `${done} of ${tasks.length} done`;
  $('#plannedTime').textContent = plannedMin ? `${durationLabel(plannedMin)} planned` : 'No time planned';
  $('#todayPlannedSummary').textContent = `${durationLabel(plannedMin) || '0m'} planned of ${appSettings.freeHoursPerDay || 6}h free`;
  $('#todayCapacityBar').style.width = `${capacityPercent}%`;
  $('#todayCapacityBar').parentElement.setAttribute('aria-valuenow', String(capacityPercent));
  $('#todayCapacityBar').parentElement.classList.toggle('over-capacity', plannedMin > freeMinutes);
  $('.progress-track').setAttribute('aria-valuenow', String(percent));
  $('#todayProgressBar').style.width = `${percent}%`;
  $('#topCount').textContent = `${top.filter(task => task.status === 'done').length} of ${Math.min(3, Math.max(top.length, 3))} done`;
  $('#topTaskList').replaceChildren();
  $('#taskList').replaceChildren();
  if (top.length) top.forEach(task => $('#topTaskList').appendChild(makeTaskRow(task, { draggable: !task.blockStart })));
  else {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Choose up to three tasks to keep in view here.';
    $('#topTaskList').appendChild(empty);
  }
  if (later.length) later.forEach(task => $('#taskList').appendChild(makeTaskRow(task, { draggable: !task.blockStart })));
  else {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = tasks.length ? 'Nothing else planned for today.' : 'Your later tasks will appear here.';
    $('#taskList').appendChild(empty);
  }

  const candidates = getCarryCandidates(allTasks, tasks);
  $('#carryOverBtn').textContent = `Carry over (${candidates.length})`;
  $('#carryOverBtn').classList.toggle('hidden', candidates.length === 0);
  const welcome = !appSettings.onboarded && tasks.length === 0;
  $('#view-today').classList.toggle('onboarding', welcome);
  $('#view-today').classList.toggle('empty-state-active', tasks.length === 0 && !welcome);
  $('#welcomeCard').classList.toggle('hidden', !welcome);
  $('#progressCard').classList.toggle('hidden', welcome);
  $('#emptyCard').classList.toggle('hidden', tasks.length > 0);

  const now = new Date();
  const scheduled = tasks.filter(task => task.blockStart && task.status !== 'done').sort((a, b) => a.blockStart.localeCompare(b.blockStart));
  const nextScheduled = scheduled.find(task => minutesOfTime(task.blockStart) >= now.getHours() * 60 + now.getMinutes());
  const nextTask = nextScheduled || tasks.find(task => task.status !== 'done');
  const nextCard = $('#upNextCard');
  nextCard.classList.toggle('hidden', !nextTask);
  $('#headerFocusBtn').classList.toggle('hidden', !nextTask);
  if (nextTask) {
    $('#upNextTitle').textContent = nextTask.title;
    $('#upNextLabel').textContent = nextTask.blockStart ? `UP NEXT · ${formatTime(nextTask.blockStart)}` : 'UP NEXT';
    $('#upNextFocusBtn').onclick = () => startFocus(nextTask);
    $('#headerFocusBtn').onclick = () => startFocus(nextTask);
  } else {
    $('#headerFocusBtn').onclick = () => showToast('Add a task before starting a focus session.');
  }
  renderTimeline($('#todayTimeline'), tasks, true);
  renderBackupReminder(tasks, candidates);
}

function renderBackupReminder(tasks) {
  const oldBackup = !appSettings.lastBackupAt || (Date.now() - appSettings.lastBackupAt) > 7 * 24 * 60 * 60 * 1000;
  const enoughTasks = tasks.length >= 10;
  const shouldShow = appSettings.backupReminder && oldBackup && (Boolean(appSettings.lastBackupAt) || enoughTasks)
    && appSettings.backupReminderDismissedOn !== localDayKey();
  $('#backupReminder').classList.toggle('hidden', !shouldShow);
}

function timeRangeLabel(task) {
  if (!task.blockStart) return '';
  return `${formatTime(task.blockStart)}${task.blockEnd ? ` – ${formatTime(task.blockEnd)}` : ''}`;
}

function blockTone(task, index) {
  const tag = (task.tag || '').toLowerCase();
  if (tag.includes('work') || index % 3 === 1) return 'block-green';
  if (tag.includes('personal') || index % 3 === 2) return 'block-amber';
  return '';
}

function renderTimeline(container, tasks, compact = false) {
  if (!container) return;
  const [startHour] = (appSettings.dayStart || '08:00').split(':').map(Number);
  const [endHour, endMinute] = (appSettings.dayEnd || '17:00').split(':').map(Number);
  const lastHour = Math.max(startHour, Math.min(23, endHour + (endMinute > 0 ? 0 : -1)));
  const scheduled = tasks.filter(task => task.blockStart).sort((a, b) => a.blockStart.localeCompare(b.blockStart));
  container.replaceChildren();
  if (!scheduled.length) {
    const empty = document.createElement('p');
    empty.className = 'timeline-empty';
    empty.textContent = 'No tasks have a time block yet.';
    container.appendChild(empty);
  }
  const hoursWithTasks = [...new Set(scheduled.map(task => Number(task.blockStart.slice(0, 2))))];
  const visibleHours = compact
    ? [...new Set([startHour, ...hoursWithTasks.filter(hour => hour >= startHour && hour <= lastHour)])].sort((a, b) => a - b)
    : hoursWithTasks.filter(hour => hour >= startHour && hour <= lastHour).sort((a, b) => a - b);
  visibleHours.forEach(hour => {
    const row = document.createElement('div');
    row.className = 'timeline-entry';
    const time = document.createElement('span');
    time.className = 'timeline-time';
    time.textContent = formatTime(`${String(hour).padStart(2, '0')}:00`);
    row.appendChild(time);
    const area = document.createElement('div');
    area.className = 'timeline-hour';
    const entries = scheduled.filter(task => Number(task.blockStart.slice(0, 2)) === hour);
    entries.forEach((task, index) => {
      const block = document.createElement('div');
      block.className = `timeline-block ${blockTone(task, index)}`;
      block.dataset.taskId = task.id;
      block.draggable = true;
      block.addEventListener('dragstart', event => event.dataTransfer?.setData('text/plain', task.id));
      const title = document.createElement('strong');
      title.textContent = task.title;
      const timeLabel = document.createElement('span');
      timeLabel.textContent = timeRangeLabel(task);
      block.append(title, timeLabel);
      area.appendChild(block);
    });
    row.appendChild(area);
    container.appendChild(row);
  });
  const outsideHours = scheduled.filter(task => {
    const hour = Number(task.blockStart.slice(0, 2));
    return hour < startHour || hour > lastHour;
  });
  outsideHours.forEach(task => {
    const row = document.createElement('div'); row.className = 'timeline-entry outside-hours';
    const time = document.createElement('span'); time.className = 'timeline-time'; time.textContent = formatTime(task.blockStart);
    const area = document.createElement('div'); area.className = 'timeline-hour';
    const block = document.createElement('div'); block.className = `timeline-block ${blockTone(task, 0)}`;
    const title = document.createElement('strong'); title.textContent = task.title;
    const range = document.createElement('span'); range.textContent = timeRangeLabel(task);
    block.append(title, range); area.appendChild(block); row.append(time, area); container.appendChild(row);
  });
  if (scheduled.length) {
    const drop = document.createElement('div');
    drop.className = 'timeline-drop';
    drop.textContent = 'Drag a task here to schedule it';
    container.appendChild(drop);
  }
  container.ondragover = event => event.preventDefault();
  container.ondrop = async event => {
    const id = event.dataTransfer?.getData('text/plain');
    if (!id) return;
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const dayStart = startHour * 60;
    const dayEnd = endHour * 60 + endMinute;
    const ratio = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    const nearestHalfHour = Math.round((dayStart + (dayEnd - dayStart) * ratio) / 30) * 30;
    await scheduleTaskAt(id, timeFromMinutes(nearestHalfHour));
  };
}

function getActiveWeekStart() {
  const date = addDays(startOfWeek(new Date()), activeWeekOffset * 7);
  return localDayKey(date);
}

function renderWeek(allTasks) {
  const monday = new Date(`${getActiveWeekStart()}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const keys = days.map(localDayKey);
  const weekTasks = allTasks.filter(task => task.day >= keys[0] && task.day <= keys[6]);
  const completed = weekTasks.filter(task => task.status === 'done').length;
  const focusMinutes = weekTasks.reduce((sum, task) => sum + (task.focusMinutes || 0), 0);
  const carried = weekTasks.filter(task => task.carriedFrom).length;
  const best = days.map((day, index) => ({ day, index, done: weekTasks.filter(task => task.day === keys[index] && task.status === 'done').length }))
    .sort((a, b) => b.done - a.done)[0];
  $('#weekRange').textContent = `${formatDateKey(keys[0], { month: 'short', day: 'numeric' })} – ${formatDateKey(keys[6], { month: 'short', day: 'numeric' })}`;
  $('#weekProgressLabel').textContent = `${completed} of ${weekTasks.length}`;
  $('#weekFocusTime').textContent = durationLabel(focusMinutes) || '0m';
  $('#weekCarryCount').textContent = `${carried} task${carried === 1 ? '' : 's'}`;
  $('#weekBestDay').textContent = best?.done ? best.day.toLocaleDateString([], { weekday: 'long' }) : '—';
  const dayHost = $('#weekDays');
  dayHost.replaceChildren();
  days.forEach((day, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `week-day${keys[index] === localDayKey() ? ' today' : ''}`;
    button.setAttribute('aria-label', `${day.toLocaleDateString([], { weekday: 'long' })}, ${weekTasks.filter(task => task.day === keys[index] && task.status === 'done').length} done`);
    const name = document.createElement('span'); name.className = 'weekday-name'; name.textContent = day.toLocaleDateString([], { weekday: 'narrow' });
    const count = document.createElement('strong'); count.className = 'weekday-count';
    const dayCount = weekTasks.filter(task => task.day === keys[index]).length;
    count.textContent = dayCount ? String(weekTasks.filter(task => task.day === keys[index] && task.status === 'done').length) : '–';
    const date = document.createElement('span'); date.className = 'weekday-date'; date.textContent = day.toLocaleDateString([], { month: 'short', day: 'numeric' });
    button.append(name, count, date);
    dayHost.appendChild(button);
  });

  const chart = $('#weekChart');
  chart.replaceChildren();
  const maxTasks = Math.max(1, ...keys.map(key => weekTasks.filter(task => task.day === key).length));
  keys.forEach((key, index) => {
    const dayTasks = weekTasks.filter(task => task.day === key);
    const doneCount = dayTasks.filter(task => task.status === 'done').length;
    const row = document.createElement('div'); row.className = 'chart-row';
    const label = document.createElement('span'); label.className = 'chart-label'; label.textContent = days[index].toLocaleDateString([], { weekday: 'short' });
    const bars = document.createElement('div'); bars.className = 'chart-bars';
    const planned = document.createElement('span'); planned.className = 'chart-bar'; planned.style.width = `${Math.max(dayTasks.length ? 4 : 0, (dayTasks.length / maxTasks) * 100)}%`;
    const done = document.createElement('span'); done.className = 'chart-bar done'; done.style.width = `${Math.max(doneCount ? 4 : 0, (doneCount / maxTasks) * 100)}%`;
    planned.setAttribute('aria-label', `${dayTasks.length} planned`); done.setAttribute('aria-label', `${doneCount} done`);
    bars.append(planned, done);
    const count = document.createElement('span'); count.className = 'chart-count'; count.textContent = `${doneCount}/${dayTasks.length}`;
    row.append(label, bars, count); chart.appendChild(row);
  });
  const legend = document.createElement('div'); legend.className = 'chart-legend'; legend.innerHTML = '<span>Planned</span><span>Done</span>'; chart.appendChild(legend);

  const tagCounts = new Map();
  weekTasks.forEach(task => { if (task.tag) tagCounts.set(task.tag, (tagCounts.get(task.tag) || 0) + 1); });
  const tagHost = $('#tagStats'); tagHost.replaceChildren();
  if (tagCounts.size) [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    const chip = document.createElement('span'); chip.className = 'tag-chip'; chip.textContent = `#${tag} ${count}`; tagHost.appendChild(chip);
  });
  else { const empty = document.createElement('span'); empty.className = 'muted'; empty.textContent = 'Tag tasks to see a breakdown.'; tagHost.appendChild(empty); }

  const triage = $('#triageList'); triage.replaceChildren();
  const carriedTasks = weekTasks.filter(task => task.carriedFrom && task.status !== 'done' && !task.carryDropped);
  if (!carriedTasks.length) {
    const empty = document.createElement('li'); empty.className = 'empty-state'; empty.textContent = 'No unfinished carry-overs this week.'; triage.appendChild(empty);
  } else carriedTasks.forEach(task => {
    const item = document.createElement('li'); item.className = 'triage-item';
    const heading = document.createElement('div'); heading.className = 'triage-title-row';
    const title = document.createElement('span'); title.className = 'triage-title'; title.textContent = task.title;
    const origin = document.createElement('span'); origin.className = 'triage-origin'; origin.textContent = formatDateKey(task.carriedFrom, { weekday: 'short' });
    heading.append(title, origin);
    const actions = document.createElement('div'); actions.className = 'triage-actions';
    const move = document.createElement('button'); move.type = 'button'; move.className = 'button secondary-button'; move.textContent = 'Move to Fri';
    move.addEventListener('click', async () => { await run(() => movePlannerTask(task.id, keys[4]), 'Moved to Friday.'); await renderAll(); });
    const drop = document.createElement('button'); drop.type = 'button'; drop.className = 'button secondary-button'; drop.textContent = 'Drop';
    drop.addEventListener('click', async () => {
      if (!(await dismissCarryOver(task))) return;
      await run(() => removePlannerTask(task.id), 'Carry-over removed.');
      await renderAll();
    });
    actions.append(move, drop); item.append(heading, actions); triage.appendChild(item);
  });

  getWeek(keys[0]).then(review => {
    const reflection = $('#reflectionInput');
    if (getActiveWeekStart() === keys[0] && document.activeElement !== reflection) reflection.value = review.reflection || '';
  });
}

function overlapExists(taskId, start, end, tasks) {
  const startMin = minutesOfTime(start);
  const endMin = minutesOfTime(end);
  return tasks.some(task => task.id !== taskId && task.blockStart && task.blockEnd
    && startMin < minutesOfTime(task.blockEnd) && endMin > minutesOfTime(task.blockStart));
}

async function scheduleTaskAt(id, start) {
  const task = await getTask(id);
  if (!task) return;
  const end = timeFromMinutes(minutesOfTime(start) + (task.estimateMin || 30));
  const siblings = await getAllTasks();
  if (overlapExists(id, start, end, siblings.filter(entry => entry.day === task.day))) showToast('This time overlaps another block. The block is still allowed.');
  await run(() => putTask({ ...task, blockStart: start, blockEnd: end, updatedAt: Date.now() }));
  await renderAll();
}

function renderBlocks(allTasks) {
  const todayTasks = allTasks.filter(task => task.day === localDayKey()).sort((a, b) => a.order - b.order);
  const plannedMin = todayTasks.reduce((sum, task) => sum + (task.estimateMin || (task.blockStart ? 30 : 0)), 0);
  const freeMinutes = Number(appSettings.freeHoursPerDay || 6) * 60;
  const ratio = freeMinutes ? Math.min(100, Math.round((plannedMin / freeMinutes) * 100)) : 0;
  $('#capacitySummary').textContent = `${durationLabel(plannedMin) || '0m'} planned`;
  $('#freeHoursInput').value = String(appSettings.freeHoursPerDay || 6);
  $('#capacityBar').style.width = `${ratio}%`;
  $('.capacity-track').classList.toggle('over-capacity', plannedMin > freeMinutes);
  $('#capacityNote').textContent = plannedMin > freeMinutes ? 'Your plan is over capacity. You can still keep every block.' : '';
  $('#capacityNote').classList.toggle('hidden', plannedMin <= freeMinutes);
  renderTimeline($('#timeline'), todayTasks, false);
  const unscheduled = todayTasks.filter(task => !task.blockStart && task.status !== 'done');
  const host = $('#unscheduledList'); host.replaceChildren();
  if (!unscheduled.length) {
    const empty = document.createElement('li'); empty.className = 'empty-state'; empty.textContent = todayTasks.length ? 'All active tasks have a place in your day.' : 'Add tasks to start planning your blocks.'; host.appendChild(empty);
  }
  unscheduled.forEach(task => {
    const item = document.createElement('li'); item.className = 'unscheduled-item';
    const title = document.createElement('strong'); title.textContent = task.title;
    const estimate = document.createElement('span'); estimate.textContent = durationLabel(task.estimateMin) || '30m';
    const place = document.createElement('button'); place.type = 'button'; place.className = 'button secondary-button'; place.textContent = 'Place';
    place.addEventListener('click', () => {
      const prior = item.querySelector('.place-editor');
      if (prior) { prior.remove(); return; }
      const editor = document.createElement('div'); editor.className = 'place-editor';
      const startLabel = document.createElement('label'); startLabel.textContent = 'Start';
      const startInput = document.createElement('input'); startInput.type = 'time'; startInput.value = appSettings.dayStart || '08:00'; startLabel.appendChild(startInput);
      const endLabel = document.createElement('label'); endLabel.textContent = 'End';
      const endInput = document.createElement('input'); endInput.type = 'time'; endInput.value = timeFromMinutes(minutesOfTime(startInput.value) + (task.estimateMin || 30)); endLabel.appendChild(endInput);
      startInput.addEventListener('change', () => { if (!endInput.dataset.manual) endInput.value = timeFromMinutes(minutesOfTime(startInput.value) + (task.estimateMin || 30)); });
      endInput.addEventListener('input', () => { endInput.dataset.manual = 'true'; });
      const save = document.createElement('button'); save.type = 'button'; save.className = 'button primary-button'; save.textContent = 'Save block';
      save.addEventListener('click', async () => {
        if (!startInput.value || !endInput.value || minutesOfTime(endInput.value) <= minutesOfTime(startInput.value)) { showToast('Choose an end time after the start time.'); return; }
        if (overlapExists(task.id, startInput.value, endInput.value, todayTasks)) showToast('This time overlaps another block. The block is still allowed.');
        await run(() => putTask({ ...task, blockStart: startInput.value, blockEnd: endInput.value, updatedAt: Date.now() }));
        await renderAll();
      });
      editor.append(startLabel, endLabel, save); item.after(editor);
    });
    item.append(title, estimate, place); host.appendChild(item);
  });
}

function selectPriority(priority) {
  selectedPriority = priority;
  $$('#priorityChoices button').forEach(button => button.classList.toggle('selected', button.dataset.priority === priority));
  priorityManuallySet = true;
  $('#topLimitMessage').classList.add('hidden');
}

function selectDay(mode) {
  selectedDayMode = mode;
  $$('#dayChoices button').forEach(button => button.classList.toggle('selected', button.dataset.day === mode));
  $('#pickDateInput').classList.toggle('hidden', mode !== 'pick');
  if (mode === 'today') selectedDate = localDayKey();
  if (mode === 'tomorrow') selectedDate = localDayKey(addDays(new Date(), 1));
  if (mode === 'pick' && !$('#pickDateInput').value) $('#pickDateInput').value = localDayKey();
  if (mode === 'pick') selectedDate = $('#pickDateInput').value;
}

function drawTagChoices() {
  const host = $('#tagChoices'); host.replaceChildren();
  const choices = [{ label: 'No tag', value: null }, ...(appSettings.tags || []).map(tag => ({ label: `#${tag}`, value: tag }))];
  choices.forEach(choice => {
    const button = document.createElement('button'); button.type = 'button'; button.className = `tag-choice${selectedTag === choice.value ? ' selected' : ''}`; button.textContent = choice.label;
    button.addEventListener('click', () => { selectedTag = choice.value; tagManuallySet = true; drawTagChoices(); });
    host.appendChild(button);
  });
}

function previewQuickAdd() {
  const parsed = parseQuickAdd($('#taskInput').value);
  if (!priorityManuallySet) {
    selectedPriority = parsed.priority;
    $$('#priorityChoices button').forEach(button => button.classList.toggle('selected', button.dataset.priority === selectedPriority));
  }
  if (!tagManuallySet) selectedTag = parsed.tag || null;
  if (parsed.blockStart) {
    $('#blockStartInput').value = parsed.blockStart;
    $('#blockEndInput').value = parsed.blockEnd;
    timeManuallySet = false;
  } else if (!timeManuallySet) {
    $('#blockStartInput').value = '';
    $('#blockEndInput').value = '';
  }
  if (!estimateManuallySet) $('#estimateInput').value = parsed.estimateMin || '';
  const host = $('#quickPreview'); host.replaceChildren();
  const chips = [];
  if (parsed.tag) chips.push(`#${parsed.tag}`);
  if (parsed.estimateMin) chips.push(durationLabel(parsed.estimateMin));
  const priority = priorityManuallySet ? selectedPriority : parsed.priority;
  if (priority !== 'normal') chips.push(priority === 'top' ? 'Top 3' : 'High');
  if (parsed.blockStart) chips.push(formatTime(parsed.blockStart));
  chips.forEach(value => { const chip = document.createElement('span'); chip.className = 'tag-chip'; chip.textContent = value; host.appendChild(chip); });
  if (parsed.tag && !(appSettings.tags || []).includes(parsed.tag)) {
    const note = document.createElement('span'); note.className = 'muted'; note.textContent = 'New tag'; host.appendChild(note);
  }
  $('#topLimitMessage').classList.add('hidden');
  drawTagChoices();
  updateOverlapMessage();
}

async function openAddTask(seedText = '', fromDesktopQuickAdd = false) {
  desktopQuickSeed = fromDesktopQuickAdd ? seedText : null;
  editingTaskId = null;
  $('#taskDialogTitle').textContent = 'New task';
  $('#taskDialogEyebrow').textContent = 'QUICK ADD';
  $('#addBtn').textContent = 'Add task';
  selectedPriority = 'normal'; selectedTag = null; selectedDayMode = 'today'; selectedDate = localDayKey();
  priorityManuallySet = false; tagManuallySet = false; timeManuallySet = false; estimateManuallySet = false;
  $('#taskInput').value = seedText;
  $('#blockStartInput').value = '';
  $('#blockEndInput').value = '';
  $('#estimateInput').value = '';
  $('#pickDateInput').value = selectedDate;
  $('#newTagInput').value = '';
  $$('#priorityChoices button').forEach(button => button.classList.toggle('selected', button.dataset.priority === 'normal'));
  selectDay('today');
  drawTagChoices();
  previewQuickAdd();
  openDialog($('#taskDialog'));
  if (!window.matchMedia('(max-width: 719px)').matches) requestAnimationFrame(() => $('#taskInput').focus());
}

async function openEditTask(task) {
  editingTaskId = task.id;
  desktopQuickSeed = null;
  $('#taskDialogTitle').textContent = 'Edit task';
  $('#taskDialogEyebrow').textContent = 'TASK DETAILS';
  $('#addBtn').textContent = 'Save changes';
  selectedPriority = task.priority || 'normal';
  selectedTag = task.tag || null;
  selectedDate = task.day;
  const tomorrow = localDayKey(addDays(new Date(), 1));
  selectedDayMode = task.day === localDayKey() ? 'today' : task.day === tomorrow ? 'tomorrow' : 'pick';
  priorityManuallySet = true; tagManuallySet = true; timeManuallySet = true; estimateManuallySet = true;
  $('#taskInput').value = task.title;
  $('#blockStartInput').value = task.blockStart || '';
  $('#blockEndInput').value = task.blockEnd || '';
  $('#estimateInput').value = task.estimateMin || '';
  $('#pickDateInput').value = task.day;
  $('#newTagInput').value = '';
  $$('#priorityChoices button').forEach(button => button.classList.toggle('selected', button.dataset.priority === selectedPriority));
  selectDay(selectedDayMode);
  drawTagChoices();
  previewQuickAdd();
  openDialog($('#taskDialog'), true);
}

function updateOverlapMessage() {
  const start = $('#blockStartInput').value;
  const end = $('#blockEndInput').value;
  const tasks = (window.__plannerTasks || []).filter(task => task.day === (selectedDate || localDayKey()));
  $('#overlapMessage').classList.toggle('hidden', !start || !end || !overlapExists(editingTaskId, start, end, tasks));
}

async function submitNewTask(event) {
  event.preventDefault();
  const parsed = parseQuickAdd($('#taskInput').value);
  if (!parsed.title) { $('#taskInput').focus(); return; }
  if (selectedDayMode === 'pick') selectedDate = $('#pickDateInput').value;
  if (!selectedDate) { showToast('Choose a day for this task.'); return; }
  const targetTasks = await getAllTasks();
  const priority = priorityManuallySet ? selectedPriority : parsed.priority;
  let finalPriority = priority;
  const topCount = targetTasks.filter(task => task.day === selectedDate && task.priority === 'top' && task.id !== editingTaskId).length;
  if (priority === 'top' && topCount >= 3) {
    finalPriority = 'normal';
    selectedPriority = 'normal';
    priorityManuallySet = true;
    $$('#priorityChoices button').forEach(button => button.classList.toggle('selected', button.dataset.priority === 'normal'));
    $('#topLimitMessage').classList.remove('hidden');
    return;
  }
  const tag = tagManuallySet ? selectedTag : (parsed.tag || selectedTag);
  if (tag && !(appSettings.tags || []).includes(tag)) {
    await updateSettings({ tags: [...new Set([...(appSettings.tags || []), tag])] });
  }
  const estimateMin = estimateManuallySet ? Number($('#estimateInput').value) || null : parsed.estimateMin;
  const start = timeManuallySet ? $('#blockStartInput').value : ($('#blockStartInput').value || parsed.blockStart);
  const defaultEnd = start ? timeFromMinutes(minutesOfTime(start) + (estimateMin || 30)) : null;
  const end = $('#blockEndInput').value || parsed.blockEnd || defaultEnd;
  if (start && end && minutesOfTime(end) <= minutesOfTime(start)) { showToast('Choose an end time after the start time.'); return; }
  if (start && end && overlapExists(editingTaskId, start, end, targetTasks.filter(task => task.day === selectedDate))) showToast('This time overlaps another block. The block is still allowed.');
  const fields = {
    title: parsed.title,
    tag,
    estimateMin,
    priority: finalPriority,
    blockStart: start || null,
    blockEnd: start ? end : null,
    day: selectedDate,
  };
  const wasEditing = Boolean(editingTaskId);
  const task = await run(() => wasEditing
    ? updatePlannerTask(editingTaskId, fields)
    : addPlannerTask(fields, selectedDate), wasEditing ? 'Task updated.' : 'Task added.');
  if (!task) return;
  await updateSettings({ onboarded: true });
  if (!wasEditing && desktopQuickSeed !== null) $('#desktopQuickInput').value = '';
  desktopQuickSeed = null;
  editingTaskId = null;
  closeDialog('taskDialog');
  await renderAll();
}

async function submitDesktopQuickAdd() {
  const input = $('#desktopQuickInput');
  const parsed = parseQuickAdd(input.value);
  if (!parsed.title) { input.focus(); return; }
  const day = localDayKey();
  const tasks = await getAllTasks();
  let priority = parsed.priority;
  if (priority === 'top' && tasks.filter(task => task.day === day && task.priority === 'top').length >= 3) {
    priority = 'normal';
    showToast('Top 3 is full. Added this task as Normal.');
  }
  if (parsed.tag && !(appSettings.tags || []).includes(parsed.tag)) {
    await updateSettings({ tags: [...new Set([...(appSettings.tags || []), parsed.tag])] });
  }
  const task = await run(() => addPlannerTask({
    title: parsed.title,
    tag: parsed.tag,
    estimateMin: parsed.estimateMin,
    priority,
    blockStart: parsed.blockStart,
    blockEnd: parsed.blockEnd,
  }, day), 'Task added.');
  if (!task) return;
  await updateSettings({ onboarded: true });
  input.value = '';
  await renderAll();
}

function openDesktopTaskForm() {
  const input = $('#desktopQuickInput');
  openAddTask(input.value, true);
}

async function carryOverAll() {
  const allTasks = await getAllTasks();
  const todayTasks = allTasks.filter(task => task.day === localDayKey());
  const candidates = getCarryCandidates(allTasks, todayTasks);
  for (const task of candidates) await run(() => carryPlannerTask(task));
  await renderAll();
  if (candidates.length) showToast(`${candidates.length} task${candidates.length === 1 ? '' : 's'} carried over.`);
  else showToast('No unfinished tasks to carry over.');
}

async function exportBackup(share = false) {
  const backup = await exportAll();
  const backupAt = Date.now();
  backup.exportedAt = new Date(backupAt).toISOString();
  backup.settings.lastBackupAt = backupAt;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const fileName = `daily-planner-backup-${localDayKey()}.json`;
  const file = new File([blob], fileName, { type: 'application/json' });
  if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ files: [file], title: 'Daily Planner backup' });
  } else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = fileName;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    if (share) showToast('Sharing is not available here. Backup downloaded instead.');
  }
  await updateSettings({ lastBackupAt: backupAt, backupReminderDismissedOn: null });
  await renderAll();
  showToast('Backup exported.');
}

async function readBackupFile(file) {
  try {
    const data = JSON.parse(await file.text());
    importCandidate = validateBackup(data);
    $('#importSummary').textContent = `${importCandidate.tasks.length} tasks, ${importCandidate.reviews.length} weeks. Choose how to apply this backup.`;
    openDialog($('#importDialog'));
  } catch (error) {
    importCandidate = null;
    showToast(error?.message || 'Could not read this backup file.');
  }
}

async function applyImport(mode) {
  if (!importCandidate) return;
  const details = `${importCandidate.tasks.length} tasks and ${importCandidate.reviews.length} weekly reviews`;
  if (mode === 'replace' && !confirm(`Replace current planner data with ${details}?`)) return;
  const result = await run(() => importAll({ app: 'daily-planner', version: 1, ...importCandidate }, mode));
  if (!result) return;
  closeDialog('importDialog');
  importCandidate = null;
  appSettings = await getSettings();
  await renderAll();
  showToast(mode === 'merge' ? 'Backup merged.' : 'Backup restored.');
}

function renderData() {
  $('#lastBackupLabel').textContent = appSettings.lastBackupAt ? new Date(appSettings.lastBackupAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'never';
  $('#backupReminderToggle').checked = Boolean(appSettings.backupReminder);
  $('#focusLengthInput').value = String(appSettings.focusMin || 25);
  $('#dayStartInput').value = appSettings.dayStart || '08:00';
  $('#dayEndInput').value = appSettings.dayEnd || '17:00';
  const status = appSettings.persistentStorage;
  const mode = getStorageMode();
  $('#storagePersistenceStatus').textContent = status === null || status === undefined
    ? `${mode === 'indexedDB' ? 'IndexedDB' : mode === 'localStorage' ? 'Local browser storage' : 'In-memory storage for this session'} is active.`
    : status ? 'The browser has reserved this planner’s storage.' : 'The browser could not reserve storage. Export a backup to keep a copy.';
  $('#storagePersistenceBadge').textContent = status === null || status === undefined ? (mode === 'indexedDB' ? 'IndexedDB' : mode === 'localStorage' ? 'Local storage' : 'Session only') : status ? 'Requested' : 'Not granted';
}

async function saveFocusPreference() {
  const focusMin = Math.max(5, Math.min(120, Number($('#focusLengthInput').value) || 25));
  await updateSettings({ focusMin });
  renderData();
}

async function saveTimePreferences() {
  const dayStart = $('#dayStartInput').value || '08:00';
  const dayEnd = $('#dayEndInput').value || '17:00';
  if (minutesOfTime(dayEnd) <= minutesOfTime(dayStart)) { showToast('Day end needs to be after day start.'); return; }
  await updateSettings({ dayStart, dayEnd });
  await renderAll();
}

async function saveFreeHours() {
  const freeHoursPerDay = Math.max(1, Math.min(24, Number($('#freeHoursInput').value) || 6));
  await updateSettings({ freeHoursPerDay });
  await renderAll();
}

async function renderAll() {
  if (!appSettings) appSettings = await getSettings();
  const tasks = await getAllTasks();
  window.__plannerTasks = tasks;
  renderToday(tasks);
  renderWeek(tasks);
  renderBlocks(tasks);
  renderData();
}

async function startFocus(task) {
  const activeTask = task || (await getAllTasks()).find(entry => entry.day === localDayKey() && entry.status !== 'done');
  if (!activeTask) { showToast('Add a task before starting a focus session.'); return; }
  if (activeTask.status === 'todo') await run(() => setPlannerTaskStatus(activeTask.id, 'doing'));
  focusSession = {
    taskId: activeTask.id,
    phase: 'focus',
    paused: false,
    remainingMs: (appSettings.focusMin || 25) * 60 * 1000,
    endsAt: Date.now() + (appSettings.focusMin || 25) * 60 * 1000,
    segmentStartedAt: Date.now(),
    accumulatedFocusMs: 0,
    sessionNumber: Math.floor((activeTask.focusMinutes || 0) / (appSettings.focusMin || 25)) + 1,
    recorded: false,
    finished: false,
  };
  $('#focusTaskTitle').textContent = activeTask.title;
  $('#pauseFocusBtn').textContent = 'Pause';
  $('#pauseFocusBtn').disabled = false;
  $('#breakFocusBtn').textContent = 'Take a break';
  $('#breakFocusBtn').disabled = false;
  $('#focusPhaseLabel').textContent = '';
  updateFocusSessionLabel(activeTask);
  updateFocusDisplay();
  const mobileFocusLayout = window.matchMedia('(max-width: 719px), (pointer: coarse)').matches;
  $('#focusDialog').classList.toggle('mobile-focus', mobileFocusLayout);
  document.body.classList.add('focus-active');
  openDialog($('#focusDialog'), mobileFocusLayout);
  clearInterval(focusTimer);
  focusTimer = setInterval(tickFocus, 400);
  await renderAll();
}

function updateFocusSessionLabel(task) {
  const count = task.estimateMin ? Math.max(1, Math.ceil(task.estimateMin / (appSettings.focusMin || 25))) : null;
  $('#focusSessionLabel').textContent = count
    ? `Session ${focusSession.sessionNumber} of ${count} · estimated ${durationLabel(task.estimateMin)}`
    : `Session ${focusSession.sessionNumber}${task.estimateMin ? ` · estimated ${durationLabel(task.estimateMin)}` : ''}`;
}

function updateFocusDisplay() {
  if (!focusSession) return;
  const remaining = focusSession.paused ? focusSession.remainingMs : Math.max(0, focusSession.endsAt - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  $('#focusTimer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

async function recordFocusMinutes(minutes) {
  if (!focusSession || focusSession.recorded || minutes <= 0) return;
  focusSession.recorded = true;
  await run(() => addFocusMinutes(focusSession.taskId, minutes));
}

function elapsedFocusMs() {
  if (!focusSession) return 0;
  if (focusSession.phase !== 'focus' || focusSession.paused) return focusSession.accumulatedFocusMs;
  return focusSession.accumulatedFocusMs + Math.max(0, Date.now() - focusSession.segmentStartedAt);
}

async function tickFocus() {
  if (!focusSession) return;
  updateFocusDisplay();
  if (focusSession.paused || Date.now() < focusSession.endsAt) return;
  if (focusSession.phase === 'focus' && !focusSession.finished) {
    focusSession.finished = true;
    await recordFocusMinutes(Math.max(1, Math.round((appSettings.focusMin || 25))));
    $('#focusPhaseLabel').textContent = 'Session complete. Take a short break or mark this task done.';
    $('#pauseFocusBtn').disabled = true;
    $('#breakFocusBtn').disabled = false;
    $('#focusTimer').textContent = '00:00';
    await renderAll();
  } else if (focusSession.phase === 'break') {
    focusSession.finished = true;
    $('#focusPhaseLabel').textContent = 'Break complete. Ready for another session?';
    $('#breakFocusBtn').textContent = 'Focus again';
    $('#pauseFocusBtn').disabled = true;
    $('#breakFocusBtn').disabled = false;
    $('#focusTimer').textContent = '00:00';
  }
}

function pauseFocus() {
  if (!focusSession || focusSession.finished) return;
  focusSession.remainingMs = Math.max(0, focusSession.endsAt - Date.now());
  if (focusSession.phase === 'focus') focusSession.accumulatedFocusMs += Math.max(0, Date.now() - focusSession.segmentStartedAt);
  focusSession.paused = true;
  $('#pauseFocusBtn').textContent = 'Resume';
  updateFocusDisplay();
}

function resumeFocus() {
  if (!focusSession || !focusSession.paused || focusSession.finished) return;
  focusSession.paused = false;
  focusSession.endsAt = Date.now() + focusSession.remainingMs;
  if (focusSession.phase === 'focus') focusSession.segmentStartedAt = Date.now();
  $('#pauseFocusBtn').textContent = 'Pause';
  tickFocus();
}

async function takeBreak() {
  if (!focusSession) return;
  if (focusSession.phase === 'break' && focusSession.finished) {
    const task = await getTask(focusSession.taskId);
    if (task) startFocus(task);
    return;
  }
  if (focusSession.phase === 'focus' && !focusSession.recorded) {
    const elapsed = elapsedFocusMs();
    await recordFocusMinutes(Math.floor(elapsed / 60000));
  }
  focusSession.phase = 'break';
  focusSession.paused = false;
  focusSession.finished = false;
  focusSession.remainingMs = (appSettings.breakMin || 5) * 60 * 1000;
  focusSession.endsAt = Date.now() + focusSession.remainingMs;
  focusSession.segmentStartedAt = Date.now();
  $('#pauseFocusBtn').textContent = 'Pause';
  $('#pauseFocusBtn').disabled = false;
  $('#breakFocusBtn').textContent = 'Break in progress';
  $('#breakFocusBtn').disabled = true;
  $('#focusPhaseLabel').textContent = 'Step away for a few minutes.';
  updateFocusDisplay();
  await renderAll();
}

async function finishFocusTask() {
  if (!focusSession) return;
  if (!focusSession.recorded && focusSession.phase === 'focus') {
    await recordFocusMinutes(Math.floor(elapsedFocusMs() / 60000));
  }
  await run(() => setPlannerTaskStatus(focusSession.taskId, 'done'));
  clearInterval(focusTimer); focusTimer = null; focusSession = null;
  closeDialog('focusDialog');
  await renderAll();
}

export async function initUI() {
  appSettings = await getSettings();
  $$('.nav-button[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#addTaskFab').addEventListener('click', () => openAddTask());
  $('#emptyAddTaskBtn').addEventListener('click', () => openAddTask());
  $('#startPlanningBtn').addEventListener('click', async () => { await updateSettings({ onboarded: true }); await renderAll(); openAddTask(); });
  $('#previousWeekBtn').addEventListener('click', async () => { activeWeekOffset -= 1; await renderAll(); });
  $('#nextWeekBtn').addEventListener('click', async () => { activeWeekOffset += 1; await renderAll(); });
  $('#carryOverBtn').addEventListener('click', carryOverAll);
  $('#emptyCarryOverBtn').addEventListener('click', carryOverAll);
  $('#dismissBackupReminder').addEventListener('click', async () => { await updateSettings({ backupReminderDismissedOn: localDayKey() }); await renderAll(); });
  $('#taskForm').addEventListener('submit', submitNewTask);
  $('#desktopQuickAddBtn').addEventListener('click', openDesktopTaskForm);
  $('#desktopQuickInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); submitDesktopQuickAdd(); }
  });
  $('#taskInput').addEventListener('input', previewQuickAdd);
  $('#taskInput').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); $('#taskForm').requestSubmit(); }
  });
  $$('#priorityChoices button').forEach(button => button.addEventListener('click', () => selectPriority(button.dataset.priority)));
  $$('#dayChoices button').forEach(button => button.addEventListener('click', () => selectDay(button.dataset.day)));
  $('#pickDateInput').addEventListener('change', () => { selectedDate = $('#pickDateInput').value; updateOverlapMessage(); });
  $('#blockStartInput').addEventListener('change', () => {
    timeManuallySet = true;
    if (!$('#blockEndInput').value) $('#blockEndInput').value = timeFromMinutes(minutesOfTime($('#blockStartInput').value) + 30);
    updateOverlapMessage();
  });
  $('#blockEndInput').addEventListener('change', () => { timeManuallySet = true; updateOverlapMessage(); });
  $('#estimateInput').addEventListener('input', () => { estimateManuallySet = true; });
  $('#clearBlockBtn').addEventListener('click', () => { timeManuallySet = true; $('#blockStartInput').value = ''; $('#blockEndInput').value = ''; updateOverlapMessage(); });
  $('#newTagBtn').addEventListener('click', async () => {
    const rawTag = $('#newTagInput').value.trim().replace(/^#/, '');
    if (!/^[\p{L}\p{N}_-]{1,24}$/u.test(rawTag)) { showToast('Use 1–24 letters, numbers, underscores, or hyphens for a tag.'); return; }
    const tag = rawTag.toLowerCase();
    if (!(appSettings.tags || []).includes(tag)) await updateSettings({ tags: [...(appSettings.tags || []), tag] });
    selectedTag = tag; tagManuallySet = true; $('#newTagInput').value = ''; drawTagChoices();
  });
  $('#planNextWeekBtn').addEventListener('click', () => { activeWeekOffset += 1; setView('week'); renderAll(); });
  $('#reflectionInput').addEventListener('input', () => {
    clearTimeout(reflectionTimer);
    const week = getActiveWeekStart();
    const reflection = $('#reflectionInput').value;
    $('#reflectionStatus').textContent = 'Saving…';
    reflectionTimer = setTimeout(async () => {
      const saved = await run(() => saveWeek(week, { reflection }));
      if (getActiveWeekStart() === week) $('#reflectionStatus').textContent = saved ? 'Saved' : '';
    }, 450);
  });
  $('#freeHoursInput').addEventListener('change', saveFreeHours);
  $('#focusLengthInput').addEventListener('change', saveFocusPreference);
  $('#dayStartInput').addEventListener('change', saveTimePreferences);
  $('#dayEndInput').addEventListener('change', saveTimePreferences);
  $('#backupReminderToggle').addEventListener('change', async event => { await updateSettings({ backupReminder: event.target.checked }); await renderAll(); });
  $('#exportBtn').addEventListener('click', () => run(() => exportBackup(false)));
  $('#shareBtn').addEventListener('click', () => run(() => exportBackup(true)));
  $('#importBtn').addEventListener('click', () => $('#backupFile').click());
  $('#backupFile').addEventListener('change', event => { const [file] = event.target.files || []; if (file) readBackupFile(file); event.target.value = ''; });
  $('#mergeImportBtn').addEventListener('click', () => applyImport('merge'));
  $('#replaceImportBtn').addEventListener('click', () => applyImport('replace'));
  $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.dataset.closeDialog)));
  $('#pauseFocusBtn').addEventListener('click', () => focusSession?.paused ? resumeFocus() : pauseFocus());
  $('#breakFocusBtn').addEventListener('click', takeBreak);
  $('#doneFocusBtn').addEventListener('click', finishFocusTask);
  $('#focusDialog').addEventListener('close', () => { clearInterval(focusTimer); focusTimer = null; focusSession = null; $('#focusDialog').classList.remove('mobile-focus'); document.body.classList.remove('focus-active'); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && focusSession) tickFocus();
    if (!document.hidden) renderAll();
  });
  window.addEventListener('pageshow', () => renderAll());
  await renderAll();
  requestPersistentStorage().then(async () => { appSettings = await getSettings(); renderData(); }).catch(() => {});
  window.__renderTasks = renderAll;
  scheduleMidnightRefresh();
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  setTimeout(async () => { await renderAll(); scheduleMidnightRefresh(); }, midnight.getTime() - now.getTime());
}

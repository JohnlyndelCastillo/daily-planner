const DATABASE_NAME = 'daily-planner';
const DATABASE_VERSION = 1;
const FALLBACK_KEY = 'daily-planner:v1:data';
const LEGACY_DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const DEFAULT_SETTINGS = {
  id: 'app',
  freeHoursPerDay: 6,
  focusMin: 25,
  breakMin: 5,
  dayStart: '08:00',
  dayEnd: '17:00',
  backupReminder: true,
  lastBackupAt: null,
  onboarded: false,
  tags: ['work', 'personal', 'study'],
  migratedFromLocalStorage: false,
  persistRequested: false,
  persistentStorage: null,
};

const state = { tasks: [], reviews: [], settings: { ...DEFAULT_SETTINGS } };
let database = null;
let storageMode = 'memory';
let initPromise = null;

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function safeLocalStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not read local data.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('The data change was cancelled.'));
    transaction.onerror = () => reject(transaction.error || new Error('Could not save local data.'));
  });
}

function saveError(error) {
  if (error?.name === 'QuotaExceededError') {
    return new Error('Browser storage is full. Your change is still available in memory for this session.');
  }
  return error;
}

function validDateKey(value) {
  if (typeof value !== 'string' || !LEGACY_DATE_KEY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isMondayKey(value) {
  if (!validDateKey(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).getDay() === 1;
}

function validTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour < 24 && minute < 60;
}

function validTag(value) {
  return typeof value === 'string' && /^[\p{L}\p{N}_-]{1,24}$/u.test(value.replace(/^#/, '').trim());
}

function toTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeTask(task, day, order = 0) {
  const title = String(task.title ?? task.text ?? '').trim();
  const blockStart = task.blockStart || null;
  const blockEnd = task.blockEnd || null;
  return {
    id: String(task.id || makeId()),
    title,
    day: validDateKey(task.day) ? task.day : day,
    status: ['todo', 'doing', 'done'].includes(task.status) ? task.status : 'todo',
    priority: ['normal', 'high', 'top'].includes(task.priority) ? task.priority : 'normal',
    tag: validTag(task.tag) ? task.tag.trim().replace(/^#/, '').toLowerCase() : null,
    estimateMin: Number.isFinite(Number(task.estimateMin)) && Number(task.estimateMin) > 0 ? Number(task.estimateMin) : null,
    blockStart: validTime(blockStart) ? blockStart : null,
    blockEnd: validTime(blockEnd) ? blockEnd : null,
    createdAt: toTimestamp(task.createdAt) || toTimestamp(task.startTime) || Date.now(),
    startedAt: toTimestamp(task.startedAt) || toTimestamp(task.startTime),
    doneAt: toTimestamp(task.doneAt) || toTimestamp(task.endTime),
    focusMinutes: Number.isFinite(Number(task.focusMinutes)) ? Math.max(0, Number(task.focusMinutes)) : 0,
    carriedFrom: validDateKey(task.carriedFrom) ? task.carriedFrom : null,
    carryDropped: Boolean(task.carryDropped),
    order: Number.isFinite(Number(task.order)) ? Number(task.order) : order,
    updatedAt: toTimestamp(task.updatedAt) || Date.now(),
  };
}

function legacyData() {
  const storage = safeLocalStorage();
  if (!storage) return { tasks: [], dates: [] };
  const dates = [];
  const tasks = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!validDateKey(key)) continue;
      dates.push(key);
      let saved = [];
      try { saved = JSON.parse(storage.getItem(key)) || []; } catch { saved = []; }
      if (!Array.isArray(saved)) continue;
      saved.forEach((task, order) => {
        const normalized = normalizeTask(task || {}, key, order);
        if (normalized.title) {
          if (task?.carriedOver && !normalized.carriedFrom) normalized.carriedFrom = key;
          tasks.push(normalized);
        }
      });
    }
  } catch {
    return { tasks: [], dates: [] };
  }
  return { tasks, dates };
}

async function openDatabase() {
  const indexedDB = globalThis.indexedDB;
  if (!indexedDB) throw new Error('IndexedDB is unavailable.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('tasks')) {
        const tasks = db.createObjectStore('tasks', { keyPath: 'id' });
        tasks.createIndex('day', 'day', { unique: false });
        tasks.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('reviews')) db.createObjectStore('reviews', { keyPath: 'week' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open IndexedDB.'));
    request.onblocked = () => reject(new Error('Close another planner tab to finish updating local storage.'));
  });
}

async function readDatabase(db) {
  const transaction = db.transaction(['tasks', 'reviews', 'settings'], 'readonly');
  const done = transactionDone(transaction);
  const tasksRequest = transaction.objectStore('tasks').getAll();
  const reviewsRequest = transaction.objectStore('reviews').getAll();
  const settingsRequest = transaction.objectStore('settings').get('app');
  const [tasks, reviews, settings] = await Promise.all([
    requestValue(tasksRequest), requestValue(reviewsRequest), requestValue(settingsRequest),
  ]);
  await done;
  return { tasks, reviews, settings: { ...DEFAULT_SETTINGS, ...(settings || {}) } };
}

async function writeDatabaseSnapshot(db, snapshot) {
  const transaction = db.transaction(['tasks', 'reviews', 'settings'], 'readwrite');
  const done = transactionDone(transaction);
  const tasks = transaction.objectStore('tasks');
  const reviews = transaction.objectStore('reviews');
  tasks.clear();
  reviews.clear();
  snapshot.tasks.forEach(task => tasks.put(task));
  snapshot.reviews.forEach(review => reviews.put(review));
  transaction.objectStore('settings').put({ ...snapshot.settings, id: 'app' });
  try { await done; } catch (error) { throw saveError(error); }
}

async function writeDatabaseRecord(storeName, record, id, remove = false) {
  const transaction = database.transaction([storeName], 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore(storeName);
  if (remove) store.delete(id); else store.put(record);
  try { await done; } catch (error) { throw saveError(error); }
}

async function writeFallbackSnapshot(snapshot) {
  const storage = safeLocalStorage();
  if (!storage) {
    storageMode = 'memory';
    throw new Error('Browser storage is unavailable. Your changes are still in memory for this session.');
  }
  try {
    storage.setItem(FALLBACK_KEY, JSON.stringify(snapshot));
    storageMode = 'localStorage';
  } catch {
    storageMode = 'memory';
    throw new Error('The browser could not save this change. Your changes are still in memory for this session.');
  }
}

function legacyMigrationSnapshot() {
  const migrated = legacyData();
  return {
    tasks: migrated.tasks,
    reviews: [],
    settings: { ...DEFAULT_SETTINGS, migratedFromLocalStorage: true, onboarded: migrated.tasks.length > 0 },
  };
}

async function initialize() {
  try {
    database = await openDatabase();
    storageMode = 'indexedDB';
    const saved = await readDatabase(database);
    if (saved.tasks.length === 0 && !saved.settings.migratedFromLocalStorage) {
      const migrated = legacyMigrationSnapshot();
      migrated.settings = { ...saved.settings, ...migrated.settings, id: 'app' };
      await writeDatabaseSnapshot(database, migrated);
      Object.assign(state, migrated);
    } else {
      Object.assign(state, { tasks: saved.tasks.map((task, index) => normalizeTask(task, task.day, index)), reviews: saved.reviews, settings: saved.settings });
    }
  } catch {
    database = null;
    const storage = safeLocalStorage();
    let saved = null;
    try { saved = storage?.getItem(FALLBACK_KEY) ? JSON.parse(storage.getItem(FALLBACK_KEY)) : null; } catch { saved = null; }
    if (saved && Array.isArray(saved.tasks)) {
      Object.assign(state, {
        tasks: saved.tasks.map((task, index) => normalizeTask(task, task.day, index)),
        reviews: Array.isArray(saved.reviews) ? saved.reviews : [],
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) },
      });
      storageMode = 'localStorage';
    } else {
      const migrated = legacyMigrationSnapshot();
      Object.assign(state, migrated);
      storageMode = storage ? 'localStorage' : 'memory';
      if (storage) {
        try { await writeFallbackSnapshot(migrated); } catch { /* Keep migrated data in memory if storage is unavailable or full. */ }
      }
    }
  }
  return storageMode;
}

export function initStorage() {
  if (!initPromise) initPromise = initialize();
  return initPromise;
}

export function getStorageMode() { return storageMode; }
export function getTasksByDaySync(day) { return clone(state.tasks.filter(task => task.day === day).sort((a, b) => a.order - b.order)); }
export async function getTasksByDay(day) { await initStorage(); return getTasksByDaySync(day); }
export function getAllTasksSync() { return clone(state.tasks); }
export async function getAllTasks() { await initStorage(); return getAllTasksSync(); }
export function getTaskSync(id) { const task = state.tasks.find(entry => entry.id === id); return task ? clone(task) : null; }
export async function getTask(id) { await initStorage(); return getTaskSync(id); }

export async function putTask(task) {
  await initStorage();
  const normalized = normalizeTask(task, task.day, task.order);
  const previous = state.tasks.findIndex(entry => entry.id === normalized.id);
  if (previous === -1) state.tasks.push(normalized); else state.tasks[previous] = normalized;
  if (database) await writeDatabaseRecord('tasks', normalized, normalized.id);
  else await writeFallbackSnapshot(clone(state));
  return clone(normalized);
}

export async function deleteTask(id) {
  await initStorage();
  state.tasks = state.tasks.filter(task => task.id !== id);
  if (database) await writeDatabaseRecord('tasks', null, id, true);
  else await writeFallbackSnapshot(clone(state));
}

export async function getWeek(week) {
  await initStorage();
  return clone(state.reviews.find(review => review.week === week) || { week, reflection: '', updatedAt: null });
}

export async function saveWeek(week, fields = {}) {
  await initStorage();
  const previous = state.reviews.find(review => review.week === week) || { week, reflection: '' };
  const updated = { ...previous, ...fields, week, updatedAt: Date.now() };
  const index = state.reviews.findIndex(review => review.week === week);
  if (index === -1) state.reviews.push(updated); else state.reviews[index] = updated;
  if (database) await writeDatabaseRecord('reviews', updated, week);
  else await writeFallbackSnapshot(clone(state));
  return clone(updated);
}

export async function getSettings() { await initStorage(); return clone(state.settings); }

export async function saveSettings(fields) {
  await initStorage();
  state.settings = { ...state.settings, ...fields, id: 'app' };
  if (database) await writeDatabaseRecord('settings', state.settings, 'app');
  else await writeFallbackSnapshot(clone(state));
  return clone(state.settings);
}

export async function requestPersistentStorage() {
  await initStorage();
  if (state.settings.persistRequested) return state.settings.persistentStorage;
  let persistentStorage = false;
  try {
    if (globalThis.navigator?.storage?.persist) persistentStorage = Boolean(await globalThis.navigator.storage.persist());
  } catch { persistentStorage = false; }
  await saveSettings({ persistRequested: true, persistentStorage });
  return persistentStorage;
}

export async function exportAll() {
  await initStorage();
  return {
    app: 'daily-planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: clone(state.tasks),
    reviews: clone(state.reviews),
    settings: clone(state.settings),
  };
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object' || data.app !== 'daily-planner') throw new Error('This file is not a Daily Planner backup.');
  if (!Number.isInteger(data.version) || data.version > 1) throw new Error('This backup was created by a newer planner version. Update the app before importing it.');
  if (data.version !== 1) throw new Error('This backup version is not supported.');
  if (!Array.isArray(data.tasks) || !Array.isArray(data.reviews) || !data.settings || typeof data.settings !== 'object') throw new Error('The backup is incomplete or damaged.');
  const ids = new Set();
  const tasks = data.tasks.map((task, index) => {
    if (!task || typeof task !== 'object' || !validDateKey(task.day) || !String(task.id || '').trim() || !String(task.title ?? task.text ?? '').trim()) {
      throw new Error(`Task ${index + 1} in the backup is invalid.`);
    }
    const normalized = normalizeTask(task, task.day, index);
    if (ids.has(normalized.id)) throw new Error(`Task ${index + 1} repeats an ID already used in this backup.`);
    if (normalized.blockStart && normalized.blockEnd && normalized.blockEnd <= normalized.blockStart) throw new Error(`Task ${index + 1} has an invalid time block.`);
    ids.add(normalized.id);
    return normalized;
  });
  const topCounts = new Map();
  tasks.filter(task => task.priority === 'top').forEach(task => topCounts.set(task.day, (topCounts.get(task.day) || 0) + 1));
  if ([...topCounts.values()].some(count => count > 3)) throw new Error('A day in this backup has more than three Top 3 tasks.');
  const reviews = data.reviews.map((review, index) => {
    if (!review || typeof review !== 'object' || !isMondayKey(review.week) || typeof review.reflection !== 'string') {
      throw new Error(`Weekly review ${index + 1} in the backup is invalid.`);
    }
    return { week: review.week, reflection: review.reflection, updatedAt: toTimestamp(review.updatedAt) || Date.now() };
  });
  const settings = { ...DEFAULT_SETTINGS, ...data.settings, migratedFromLocalStorage: true, id: 'app' };
  if (!Number.isFinite(Number(settings.freeHoursPerDay)) || Number(settings.freeHoursPerDay) < 1 || Number(settings.freeHoursPerDay) > 24) throw new Error('The backup has an invalid daily capacity setting.');
  if (!Number.isFinite(Number(settings.focusMin)) || Number(settings.focusMin) < 5 || Number(settings.focusMin) > 120) throw new Error('The backup has an invalid focus length.');
  if (!Number.isFinite(Number(settings.breakMin)) || Number(settings.breakMin) < 1 || Number(settings.breakMin) > 60) throw new Error('The backup has an invalid break length.');
  if (!Array.isArray(settings.tags) || settings.tags.some(tag => !validTag(tag))) throw new Error('The backup has an invalid tag list.');
  if (!validTime(settings.dayStart) || !validTime(settings.dayEnd) || settings.dayEnd <= settings.dayStart) throw new Error('The backup has invalid day start or end times.');
  if (typeof settings.backupReminder !== 'boolean' || typeof settings.onboarded !== 'boolean') throw new Error('The backup has invalid planner preferences.');
  if (settings.lastBackupAt !== null && settings.lastBackupAt !== undefined && toTimestamp(settings.lastBackupAt) === null) throw new Error('The backup has an invalid last-backup date.');
  if (settings.persistentStorage !== null && settings.persistentStorage !== undefined && typeof settings.persistentStorage !== 'boolean') throw new Error('The backup has an invalid storage preference.');
  settings.freeHoursPerDay = Number(settings.freeHoursPerDay);
  settings.focusMin = Number(settings.focusMin);
  settings.breakMin = Number(settings.breakMin);
  settings.lastBackupAt = toTimestamp(settings.lastBackupAt);
  settings.backupReminderDismissedOn = validDateKey(settings.backupReminderDismissedOn) ? settings.backupReminderDismissedOn : null;
  settings.persistentStorage = typeof settings.persistentStorage === 'boolean' ? settings.persistentStorage : null;
  settings.tags = [...new Set(settings.tags.map(tag => tag.trim().toLowerCase()))];
  return { tasks, reviews, settings };
}

export async function importAll(data, mode = 'replace') {
  await initStorage();
  if (!['replace', 'merge'].includes(mode)) throw new Error('Choose whether to replace or merge the backup.');
  const incoming = validateBackup(data);
  let next = incoming;
  if (mode === 'merge') {
    const tasksById = new Map(state.tasks.map(task => [task.id, task]));
    incoming.tasks.forEach(task => {
      const existing = tasksById.get(task.id);
      if (!existing || (task.updatedAt || task.createdAt) >= (existing.updatedAt || existing.createdAt)) tasksById.set(task.id, task);
    });
    const reviewsByWeek = new Map(state.reviews.map(review => [review.week, review]));
    incoming.reviews.forEach(review => {
      const existing = reviewsByWeek.get(review.week);
      if (!existing || (review.updatedAt || 0) >= (existing.updatedAt || 0)) reviewsByWeek.set(review.week, review);
    });
    next = {
      tasks: [...tasksById.values()],
      reviews: [...reviewsByWeek.values()],
      settings: { ...state.settings, ...incoming.settings, id: 'app' },
    };
  }
  if (database) await writeDatabaseSnapshot(database, next);
  else await writeFallbackSnapshot(next);
  Object.assign(state, clone(next));
  return { tasks: next.tasks.length, reviews: next.reviews.length };
}

// Compatibility helpers for the previous localStorage-based app and its data format.
function getTodayKey() { return new Date().toISOString().split('T')[0]; }
export function getTasks() {
  try { return JSON.parse(safeLocalStorage()?.getItem(getTodayKey()) || '[]') || []; } catch { return []; }
}
export function getTasksByDate(dateKey) {
  try { return JSON.parse(safeLocalStorage()?.getItem(dateKey) || '[]') || []; } catch { return []; }
}
export function saveTasks(tasks) {
  try { safeLocalStorage()?.setItem(getTodayKey(), JSON.stringify(tasks)); } catch { /* Legacy callers cannot surface storage errors. */ }
}
export function getAllDates() {
  const storage = safeLocalStorage();
  if (!storage) return [];
  try { return Object.keys(storage).filter(key => validDateKey(key)); } catch { return []; }
}

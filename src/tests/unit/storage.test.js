import { describe, it, expect, beforeEach } from 'vitest';
import { getTasks, saveTasks, getTasksByDate, getAllDates } from '../../js/storage.js';

beforeEach(() => localStorage.clear());

describe('getTasks', () => {
  it('returns empty array when no tasks exist', () => {
    expect(getTasks()).toEqual([]);
  });

  it('returns tasks saved for today', () => {
    const tasks = [{ text: 'Test', status: 'todo', startTime: null, endTime: null }];
    saveTasks(tasks);
    expect(getTasks()).toEqual(tasks);
  });

  it('returns empty array when localStorage has corrupted data', () => {
    const todayKey = new Date().toISOString().split('T')[0];
    localStorage.setItem(todayKey, 'not-valid-json{{');
    expect(getTasks()).toEqual([]);
  });
});

describe('getTasksByDate', () => {
  it('returns tasks for a specific date', () => {
    const tasks = [{ text: 'Old task', status: 'todo', startTime: null, endTime: null }];
    localStorage.setItem('2026-04-17', JSON.stringify(tasks));
    expect(getTasksByDate('2026-04-17')).toEqual(tasks);
  });

  it('returns empty array for date with no tasks', () => {
    expect(getTasksByDate('2026-01-01')).toEqual([]);
  });

  it('returns empty array when data is corrupted for a specific date', () => {
    localStorage.setItem('2026-04-17', 'not-valid-json{{');
    expect(getTasksByDate('2026-04-17')).toEqual([]);
  });
});

describe('getAllDates', () => {
  it('returns only date-formatted keys', () => {
    localStorage.setItem('2026-04-17', '[]');
    localStorage.setItem('2026-04-18', '[]');
    localStorage.setItem('carryover-seen-2026-04-19', 'true');
    expect(getAllDates()).toEqual(['2026-04-17', '2026-04-18']);
  });

  it('returns empty array when localStorage is empty', () => {
    expect(getAllDates()).toEqual([]);
  });

  it('excludes non-date keys', () => {
    localStorage.setItem('some-random-key', 'value');
    localStorage.setItem('2026-04-17', '[]');
    expect(getAllDates()).toEqual(['2026-04-17']);
  });
});
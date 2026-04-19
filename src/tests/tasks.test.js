import { describe, it, expect, beforeEach } from 'vitest';
import { addTask, startTask, markDone, deleteTask, carryOverTask } from '../js/tasks.js';
import { getTasks, saveTasks } from '../js/storage.js';

beforeEach(() => localStorage.clear());

describe('addTask', () => {
  it('adds a task with todo status', () => {
    addTask('Write test cases');
    const tasks = getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Write test cases');
    expect(tasks[0].status).toBe('todo');
  });
});

describe('startTask', () => {
  it('sets status to doing and records startTime', () => {
    addTask('Test task');
    startTask(0);
    const tasks = getTasks();
    expect(tasks[0].status).toBe('doing');
    expect(tasks[0].startTime).not.toBeNull();
  });
});

describe('markDone', () => {
  it('sets status to done and records endTime', () => {
    addTask('Test task');
    markDone(0);
    const tasks = getTasks();
    expect(tasks[0].status).toBe('done');
    expect(tasks[0].endTime).not.toBeNull();
  });
});

describe('deleteTask', () => {
  it('removes the task at the given index', () => {
    addTask('Task 1');
    addTask('Task 2');
    deleteTask(0);
    const tasks = getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Task 2');
  });
});

describe('carryOverTask', () => {
  it('adds task to today with carriedOver flag', () => {
    const task = { text: 'Old task', status: 'doing', startTime: '2026-04-18T09:00:00Z', endTime: null, sourceDate: '2026-04-18' };
    carryOverTask(task);
    const tasks = getTasks();
    expect(tasks[0].carriedOver).toBe(true);
    expect(tasks[0].status).toBe('todo');
    expect(tasks[0].startTime).toBeNull();
    expect(tasks[0].carriedFrom).toBe('2026-04-18');
  });
});
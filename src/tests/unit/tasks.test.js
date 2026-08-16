import { describe, it, expect, beforeEach } from 'vitest';
import { addTask, startTask, markDone, deleteTask, carryOverTask, editTask } from '../../js/tasks.js';
import { getTasks } from '../../js/storage.js';

beforeEach(() => localStorage.clear());

describe('addTask', () => {
  it('adds a task with todo status', () => {
    addTask('Write test cases');
    const tasks = getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Write test cases');
    expect(tasks[0].status).toBe('todo');
  });

  it('adds multiple tasks in order', () => {
    addTask('Task 1');
    addTask('Task 2');
    const tasks = getTasks();
    expect(tasks).toHaveLength(2);
    expect(tasks[0].text).toBe('Task 1');
    expect(tasks[1].text).toBe('Task 2');
  });

  it('sets startTime and endTime to null on creation', () => {
    addTask('Test task');
    const tasks = getTasks();
    expect(tasks[0].startTime).toBeNull();
    expect(tasks[0].endTime).toBeNull();
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

  it('does not overwrite startTime if already set', () => {
    addTask('Test task');
    startTask(0);
    const firstStart = getTasks()[0].startTime;
    startTask(0);
    expect(getTasks()[0].startTime).toBe(firstStart);
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

  it('sets startTime if not already set when marking done', () => {
    addTask('Test task');
    markDone(0);
    const tasks = getTasks();
    expect(tasks[0].startTime).not.toBeNull();
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

  it('results in empty list when last task is deleted', () => {
    addTask('Task 1');
    deleteTask(0);
    expect(getTasks()).toHaveLength(0);
  });
});

describe('editTask', () => {
  it('updates the task text at the given index', () => {
    addTask('Old text');
    editTask(0, 'New text');
    expect(getTasks()[0].text).toBe('New text');
  });

  it('does not change the task status when editing', () => {
    addTask('Test task');
    startTask(0);
    editTask(0, 'Updated text');
    expect(getTasks()[0].status).toBe('doing');
  });

  it('does not save if new text is empty', () => {
    addTask('Original text');
    editTask(0, '   ');
    expect(getTasks()[0].text).toBe('Original text');
  });

  it('does not change startTime or endTime when editing', () => {
    addTask('Test task');
    markDone(0);
    const { startTime, endTime } = getTasks()[0];
    editTask(0, 'Edited text');
    const updated = getTasks()[0];
    expect(updated.startTime).toBe(startTime);
    expect(updated.endTime).toBe(endTime);
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

  it('resets endTime to null when carrying over', () => {
    const task = { text: 'Old task', status: 'done', startTime: '2026-04-18T09:00:00Z', endTime: '2026-04-18T10:00:00Z', sourceDate: '2026-04-18' };
    carryOverTask(task);
    expect(getTasks()[0].endTime).toBeNull();
  });

  it('preserves original carriedFrom across multiple carry overs', () => {
    const task = { text: 'Old task', status: 'todo', startTime: null, endTime: null, sourceDate: '2026-04-16', carriedFrom: '2026-04-16' };
    carryOverTask(task);
    const carried = getTasks()[0];
    expect(carried.carriedFrom).toBe('2026-04-16');
  });

  it('carries over multiple tasks', () => {
    const tasks = [
      { text: 'Task 1', status: 'todo', startTime: null, endTime: null, sourceDate: '2026-04-18' },
      { text: 'Task 2', status: 'doing', startTime: null, endTime: null, sourceDate: '2026-04-18' },
    ];
    tasks.forEach(t => carryOverTask(t));
    expect(getTasks()).toHaveLength(2);
  });
});
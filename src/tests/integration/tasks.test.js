import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initUI } from '../../js/ui.js';
import { setupPlannerDOM, addTaskViaUI } from '../helpers/plannerDom.js';

beforeEach(() => {
  localStorage.clear();
  setupPlannerDOM();
  initUI();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

// ── Rendering ────────────────────────────────────────────────────────
describe('Initial render', () => {
  it('shows empty state when no tasks exist', () => {
    expect(document.getElementById('taskList').textContent).toContain('Nothing yet');
  });

  it('shows date label', () => {
    expect(document.getElementById('dateLabel').textContent).not.toBe('');
  });

  it('shows Empty in task count when no tasks', () => {
    expect(document.getElementById('taskCount').textContent).toBe('Empty');
  });
});

// ── Adding tasks ─────────────────────────────────────────────────────
describe('Adding tasks', () => {
  it('renders a task after adding', () => {
    addTaskViaUI('Write test cases');
    expect(document.getElementById('taskList').textContent).toContain('Write test cases');
  });

  it('clears input after adding', () => {
    addTaskViaUI('Write test cases');
    expect(document.getElementById('taskInput').value).toBe('');
  });

  it('does not add empty task', () => {
    addTaskViaUI('   ');
    expect(document.getElementById('taskList').textContent).toContain('Nothing yet');
  });

  it('updates task count after adding', () => {
    addTaskViaUI('Task 1');
    expect(document.getElementById('taskCount').textContent).toBe('0 / 1 done');
  });

  it('renders multiple tasks', () => {
    addTaskViaUI('Task 1');
    addTaskViaUI('Task 2');
    const items = document.getElementById('taskList').querySelectorAll('li');
    expect(items).toHaveLength(2);
  });

  it('adds task on Enter key', () => {
    const input = document.getElementById('taskInput');
    input.value = 'Keyboard task';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false, bubbles: true }));
    expect(document.getElementById('taskList').textContent).toContain('Keyboard task');
  });

  it('does not add task on Shift+Enter', () => {
    const input = document.getElementById('taskInput');
    input.value = 'Should not add';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(document.getElementById('taskList').textContent).toContain('Nothing yet');
  });
});

// ── Task status ──────────────────────────────────────────────────────
describe('Task status flow', () => {
  it('shows Start button for todo tasks', () => {
    addTaskViaUI('Test task');
    expect(document.getElementById('taskList').textContent).toContain('▶ Start');
  });

  it('clicking Start changes status to Doing', () => {
    addTaskViaUI('Test task');
    const startBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Start'));
    startBtn.click();
    expect(document.getElementById('taskList').textContent).toContain('Doing');
    expect(document.getElementById('taskList').textContent).toContain('✓ Done');
  });

  it('clicking Done marks task as done', () => {
    addTaskViaUI('Test task');
    const startBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Start'));
    startBtn.click();
    const doneBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Done'));
    doneBtn.click();
    expect(document.getElementById('taskList').textContent).toContain('Done');
  });

  it('updates task count when task is done', () => {
    addTaskViaUI('Task 1');
    const startBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Start'));
    startBtn.click();
    const doneBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Done'));
    doneBtn.click();
    expect(document.getElementById('taskCount').textContent).toBe('1 / 1 done');
  });

  it('shows started time after clicking Start', () => {
    addTaskViaUI('Test task');
    const startBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Start'));
    startBtn.click();
    expect(document.getElementById('taskList').textContent).toContain('Started:');
  });

  it('shows completed time after clicking Done', () => {
    addTaskViaUI('Test task');
    const startBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Start'));
    startBtn.click();
    const doneBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Done'));
    doneBtn.click();
    expect(document.getElementById('taskList').textContent).toContain('Completed:');
  });
});

// ── Deleting tasks ───────────────────────────────────────────────────
describe('Deleting tasks', () => {
  it('removes task after clicking Remove', () => {
    addTaskViaUI('Task to remove');
    vi.stubGlobal('confirm', () => true);
    const removeBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Remove'));
    removeBtn.click();
    expect(document.getElementById('taskList').textContent).toContain('Nothing yet');
  });

  it('does not remove task if confirm is cancelled', () => {
    addTaskViaUI('Task to keep');
    vi.stubGlobal('confirm', () => false);
    const removeBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Remove'));
    removeBtn.click();
    expect(document.getElementById('taskList').textContent).toContain('Task to keep');
  });

  it('shows empty state after all tasks removed', () => {
    addTaskViaUI('Only task');
    vi.stubGlobal('confirm', () => true);
    const removeBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Remove'));
    removeBtn.click();
    expect(document.getElementById('taskCount').textContent).toBe('Empty');
  });
});

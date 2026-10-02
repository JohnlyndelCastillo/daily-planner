import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initUI } from '../../js/ui.js';
import { setupPlannerDOM } from '../helpers/plannerDom.js';

beforeEach(() => {
  localStorage.clear();
  setupPlannerDOM();
  initUI();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('Carry over banner', () => {
  function seedYesterdayTasks(tasks) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = yesterday.toISOString().split('T')[0];
    localStorage.setItem(key, JSON.stringify(tasks));
  }

  it('shows banner when yesterday has unfinished tasks', () => {
    seedYesterdayTasks([
      { text: 'Unfinished task', status: 'todo', startTime: null, endTime: null, carriedOver: false }
    ]);
    // Re-init UI to trigger checkCarryOver
    document.body.innerHTML = '';
    setupPlannerDOM();
    initUI();
    expect(document.getElementById('carryOverBanner')).not.toBeNull();
  });

  it('does not show banner when all past tasks are done', () => {
    seedYesterdayTasks([
      { text: 'Done task', status: 'done', startTime: null, endTime: null, carriedOver: false }
    ]);
    document.body.innerHTML = '';
    setupPlannerDOM();
    initUI();
    expect(document.getElementById('carryOverBanner')).toBeNull();
  });

  it('does not show banner if already seen today', () => {
    const todayKey = new Date().toISOString().split('T')[0];
    localStorage.setItem(`carryover-seen-${todayKey}`, 'true');
    seedYesterdayTasks([
      { text: 'Unfinished task', status: 'todo', startTime: null, endTime: null, carriedOver: false }
    ]);
    document.body.innerHTML = '';
    setupPlannerDOM();
    initUI();
    expect(document.getElementById('carryOverBanner')).toBeNull();
  });

  it('sets seen flag and removes banner on dismiss', () => {
    seedYesterdayTasks([
      { text: 'Unfinished task', status: 'todo', startTime: null, endTime: null, carriedOver: false }
    ]);
    document.body.innerHTML = '';
    setupPlannerDOM();
    initUI();

    const dismissBtn = [...document.querySelectorAll('button')].find(b => b.textContent === 'Dismiss');
    dismissBtn.click();

    const todayKey = new Date().toISOString().split('T')[0];
    expect(localStorage.getItem(`carryover-seen-${todayKey}`)).toBe('true');
    expect(document.getElementById('carryOverBanner')).toBeNull();
  });

  it('adds tasks to today and removes banner on carry all over', () => {
    seedYesterdayTasks([
      { text: 'Carry me over', status: 'todo', startTime: null, endTime: null, carriedOver: false }
    ]);
    document.body.innerHTML = '';
    setupPlannerDOM();
    initUI();

    const carryBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Carry All Over'));
    carryBtn.click();

    expect(document.getElementById('carryOverBanner')).toBeNull();
    expect(document.getElementById('taskList').textContent).toContain('Carry me over');
  });

  it('shows carried over tag on carried tasks', () => {
    seedYesterdayTasks([
      { text: 'Carried task', status: 'todo', startTime: null, endTime: null, carriedOver: false }
    ]);
    document.body.innerHTML = '';
    setupPlannerDOM();
    initUI();

    const carryBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Carry All Over'));
    carryBtn.click();

    expect(document.getElementById('taskList').textContent).toContain('Carried over from');
  });
});

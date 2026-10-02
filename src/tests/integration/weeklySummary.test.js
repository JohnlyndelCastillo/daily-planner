import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initUI } from '../../js/ui.js';
import { setupPlannerDOM } from '../helpers/plannerDom.js';

beforeEach(() => {
  localStorage.clear();
  setupPlannerDOM();
  initUI();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Weekly summary', () => {
  it('renders weekly completion and a row for each day', () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    localStorage.setItem(todayKey, JSON.stringify([
      { text: 'Completed task', status: 'done' },
      { text: 'Open task', status: 'todo' },
    ]));
    window.__renderTasks();
    document.getElementById('insightsToggle').click();

    expect(document.getElementById('weekDays').children).toHaveLength(7);
    expect(document.getElementById('weekProgressLabel').textContent).toBe('1 of 2 tasks completed');
    expect(document.getElementById('weekPercent').textContent).toBe('50%');
    expect(document.querySelector('.weekly-progress-track').getAttribute('aria-valuenow')).toBe('50');
    expect(document.querySelector('.week-day-label.today').textContent).toContain('Today');
  });
});

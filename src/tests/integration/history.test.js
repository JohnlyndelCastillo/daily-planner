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

describe('Task history', () => {
  function yesterdayKey() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  function reinitializeWithHistory(tasks) {
    localStorage.setItem(yesterdayKey(), JSON.stringify(tasks));
    document.body.innerHTML = '';
    setupPlannerDOM();
    initUI();
  }

  it('shows saved tasks for a selected past date without changing today', () => {
    reinitializeWithHistory([
      { text: 'Reviewed release notes', status: 'done', startTime: null, endTime: null },
      { text: 'Prepare tomorrow plan', status: 'todo', startTime: null, endTime: null },
    ]);

    document.getElementById('insightsToggle').click();
    document.getElementById('historyToggle').click();
    const selector = document.getElementById('historyDate');
    expect(selector.value).toBe(yesterdayKey());
    selector.dispatchEvent(new Event('change', { bubbles: true }));

    expect(document.getElementById('historyTaskList').textContent).toContain('Reviewed release notes');
    expect(document.getElementById('historyTaskList').textContent).toContain('Prepare tomorrow plan');
    expect(document.getElementById('historySummary').textContent).toBe('1 of 2 tasks completed');
    expect(document.getElementById('taskList').textContent).not.toContain('Reviewed release notes');
    expect(document.getElementById('historyPanel').classList.contains('hidden')).toBe(false);
  });

  it('shows an empty state when no previous days have saved tasks', () => {
    expect(document.getElementById('historyDate').options[0].textContent).toBe('No saved days yet');
    expect(document.getElementById('historyDate').disabled).toBe(true);
    expect(document.getElementById('historySummary').textContent).toContain('Past tasks will appear here');
  });
});

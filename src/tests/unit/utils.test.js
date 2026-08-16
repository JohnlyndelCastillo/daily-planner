import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fmt, autoResize } from '../../js/utils.js';

beforeEach(() => localStorage.clear());

describe('fmt', () => {
  it('formats ISO string to 12h time', () => {
    const iso = new Date(2026, 3, 19, 9, 30).toISOString();
    expect(fmt(iso)).toMatch(/9:30 AM/i);
  });

  it('returns a string', () => {
    expect(typeof fmt(new Date().toISOString())).toBe('string');
  });

  it('formats PM time correctly', () => {
    const iso = new Date(2026, 3, 19, 14, 45).toISOString();
    expect(fmt(iso)).toMatch(/2:45 PM/i);
  });

  it('formats midnight correctly', () => {
    const iso = new Date(2026, 3, 19, 0, 0).toISOString();
    expect(fmt(iso)).toMatch(/12:00 AM/i);
  });

  it('formats noon correctly', () => {
    const iso = new Date(2026, 3, 19, 12, 0).toISOString();
    expect(fmt(iso)).toMatch(/12:00 PM/i);
  });
});

describe('checkCarryOver', () => {
  it('does not show banner if no past tasks exist', async () => {
    const { checkCarryOver } = await import('../../js/utils.js');
    const showBanner = vi.fn();
    vi.doMock('../js/ui.js', () => ({ showCarryOverBanner: showBanner }));
    checkCarryOver();
    expect(showBanner).not.toHaveBeenCalled();
  });

  it('does not show banner if all past tasks are done', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = yesterday.toISOString().split('T')[0];
    localStorage.setItem(key, JSON.stringify([
      { text: 'Done task', status: 'done', startTime: null, endTime: null, carriedOver: false }
    ]));
    const { checkCarryOver } = await import('../../js/utils.js');
    checkCarryOver();
    // banner should not appear — verified by no carryOverBanner in DOM
    expect(document.getElementById('carryOverBanner')).toBeNull();
  });

  it('does not show banner if already seen today', async () => {
    const todayKey = new Date().toISOString().split('T')[0];
    localStorage.setItem(`carryover-seen-${todayKey}`, 'true');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = yesterday.toISOString().split('T')[0];
    localStorage.setItem(key, JSON.stringify([
      { text: 'Unfinished task', status: 'todo', startTime: null, endTime: null, carriedOver: false }
    ]));
    const { checkCarryOver } = await import('../../js/utils.js');
    checkCarryOver();
    expect(document.getElementById('carryOverBanner')).toBeNull();
  });
});
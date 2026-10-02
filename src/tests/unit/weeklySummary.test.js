import { beforeEach, describe, expect, it } from 'vitest';
import { getWeeklySummary } from '../../js/weeklySummary.js';

beforeEach(() => localStorage.clear());

describe('getWeeklySummary', () => {
  it('collects Monday through Sunday tasks and calculates completion', () => {
    localStorage.setItem('2026-10-05', JSON.stringify([
      { status: 'done' },
      { status: 'todo' },
    ]));
    localStorage.setItem('2026-10-06', JSON.stringify([
      { status: 'done' },
    ]));
    localStorage.setItem('2026-10-04', JSON.stringify([
      { status: 'done' },
    ]));

    const summary = getWeeklySummary(new Date('2026-10-07T12:00:00.000Z'));

    expect(summary.startDate).toBe('2026-10-05');
    expect(summary.endDate).toBe('2026-10-11');
    expect(summary.days).toHaveLength(7);
    expect(summary.totalTasks).toBe(3);
    expect(summary.totalCompleted).toBe(2);
    expect(summary.completionRate).toBe(67);
    expect(summary.days[2].isToday).toBe(true);
  });

  it('starts the week on Monday when the reference date is Sunday', () => {
    const summary = getWeeklySummary(new Date('2026-10-11T12:00:00.000Z'));

    expect(summary.startDate).toBe('2026-10-05');
    expect(summary.endDate).toBe('2026-10-11');
    expect(summary.days[6].isToday).toBe(true);
  });

  it('returns a zero completion rate when the week has no tasks', () => {
    const summary = getWeeklySummary(new Date('2026-10-07T12:00:00.000Z'));

    expect(summary.totalTasks).toBe(0);
    expect(summary.totalCompleted).toBe(0);
    expect(summary.completionRate).toBe(0);
  });
});

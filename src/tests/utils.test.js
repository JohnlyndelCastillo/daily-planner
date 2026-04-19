import { describe, it, expect } from 'vitest';
import { fmt, autoResize } from '../js/utils.js';

describe('fmt', () => {
  it('formats ISO string to 12h time', () => {
    const iso = new Date(2026, 3, 19, 9, 30).toISOString();
    expect(fmt(iso)).toMatch(/9:30 AM/i);
  });

  it('returns a string', () => {
    expect(typeof fmt(new Date().toISOString())).toBe('string');
  });
});
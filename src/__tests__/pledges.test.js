import { isMemberApplicableForMonth, getObligationId } from '../services/pledgesService';

describe('Monthly Pledges Logic', () => {
  test('creates consistent deterministic obligation IDs', () => {
    expect(getObligationId('mem_123', 2026, 5)).toBe('pledge_mem_123_2026_5');
  });

  test('checks if member joined on or before the given month', () => {
    // Joined in March 2026
    const joinDate = '2026-03-15';

    // Should not be applicable for January 2026 or February 2026
    expect(isMemberApplicableForMonth(joinDate, 2026, 1)).toBe(false);
    expect(isMemberApplicableForMonth(joinDate, 2026, 2)).toBe(false);

    // Should be applicable for March 2026 and later
    expect(isMemberApplicableForMonth(joinDate, 2026, 3)).toBe(true);
    expect(isMemberApplicableForMonth(joinDate, 2026, 4)).toBe(true);
    expect(isMemberApplicableForMonth(joinDate, 2027, 1)).toBe(true);
  });

  test('handles members who joined in previous years', () => {
    const joinDate = '2025-11-01';
    expect(isMemberApplicableForMonth(joinDate, 2026, 1)).toBe(true);
    expect(isMemberApplicableForMonth(joinDate, 2025, 10)).toBe(false);
    expect(isMemberApplicableForMonth(joinDate, 2025, 12)).toBe(true);
  });
});

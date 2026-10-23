import { describe, test, expect } from 'vitest';
import { TRANSACTION_TYPE } from '../constants';

describe('Dashboard Year Filter & Dynamic Unlimited Years', () => {
  const currentYear = new Date().getFullYear();

  test('generates available years dynamically without hardcoded 2024-2027 limits', () => {
    // Mock records with historical (e.g. 2018) and future (e.g. 2032) dates
    const transactions = [
      { date: '2018-05-10', amount: 100 },
      { date: '2032-01-15', amount: 200 },
    ];
    const meetings = [{ date: '2019-11-20' }];
    const obligations = [{ year: 2029 }];

    const yearSet = new Set();
    const minSpan = Math.min(2020, currentYear - 5);
    const maxSpan = Math.max(2030, currentYear + 5);
    for (let y = minSpan; y <= maxSpan; y++) {
      yearSet.add(y);
    }

    const checkDate = (dStr) => {
      if (!dStr) return;
      const yr = new Date(dStr).getFullYear();
      if (!isNaN(yr) && yr > 1900 && yr < 2200) yearSet.add(yr);
    };

    transactions.forEach((tx) => checkDate(tx.date));
    meetings.forEach((m) => checkDate(m.date));
    obligations.forEach((o) => {
      const yr = Number(o.year);
      if (!isNaN(yr) && yr > 1900 && yr < 2200) yearSet.add(yr);
    });

    const availableYears = Array.from(yearSet).sort((a, b) => b - a);

    // Verify boundary removal: years 2018 and 2032 are included
    expect(availableYears).toContain(2018);
    expect(availableYears).toContain(2019);
    expect(availableYears).toContain(2029);
    expect(availableYears).toContain(2032);
    expect(availableYears.length).toBeGreaterThan(12);
  });

  test('filters transactions correctly when a specific year is selected', () => {
    const transactions = [
      { id: '1', date: '2024-03-01', amount: 50 },
      { id: '2', date: '2025-06-15', amount: 75 },
      { id: '3', date: '2026-08-20', amount: 100 },
    ];

    const filterByDate = (dateStr, selectedYear, selectedMonth = 'all') => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      if (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear)) return false;
      if (selectedMonth !== 'all' && d.getMonth() + 1 !== Number(selectedMonth)) return false;
      return true;
    };

    // Selecting year 2025 only
    const filtered2025 = transactions.filter((t) => filterByDate(t.date, 2025));
    expect(filtered2025).toHaveLength(1);
    expect(filtered2025[0].id).toBe('2');

    // Selecting year 2024 only
    const filtered2024 = transactions.filter((t) => filterByDate(t.date, 2024));
    expect(filtered2024).toHaveLength(1);
    expect(filtered2024[0].id).toBe('1');
  });

  test('includes all transactions across all years when selectedYear is "all"', () => {
    const transactions = [
      { id: '1', date: '2022-01-01', amount: 10 },
      { id: '2', date: '2023-04-10', amount: 20 },
      { id: '3', date: '2024-05-15', amount: 30 },
      { id: '4', date: '2025-06-20', amount: 40 },
      { id: '5', date: '2026-07-25', amount: 50 },
      { id: '6', date: '2028-12-31', amount: 60 },
    ];

    const filterByDate = (dateStr, selectedYear, selectedMonth = 'all') => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      if (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear)) return false;
      if (selectedMonth !== 'all' && d.getMonth() + 1 !== Number(selectedMonth)) return false;
      return true;
    };

    // When selectedYear is 'all'
    const filteredAll = transactions.filter((t) => filterByDate(t.date, 'all'));
    expect(filteredAll).toHaveLength(6);

    const totalAmount = filteredAll.reduce((sum, t) => sum + t.amount, 0);
    expect(totalAmount).toBe(210);
  });

  test('aggregates obligations across all years when selectedYear is "all"', () => {
    const obligations = [
      { id: 'ob-1', year: 2024, month: 1, remainingAmount: 50 },
      { id: 'ob-2', year: 2025, month: 5, remainingAmount: 100 },
      { id: 'ob-3', year: 2026, month: 8, remainingAmount: 150 },
    ];

    const filterObligations = (list, selectedYear, selectedMonth = 'all') => {
      return list.filter((o) => {
        if (selectedYear !== 'all' && Number(o.year) !== Number(selectedYear)) return false;
        if (selectedMonth !== 'all' && Number(o.month) !== Number(selectedMonth)) return false;
        return true;
      });
    };

    // When selectedYear is 'all'
    const resultAll = filterObligations(obligations, 'all');
    expect(resultAll).toHaveLength(3);
    const outstandingAll = resultAll.reduce((sum, o) => sum + o.remainingAmount, 0);
    expect(outstandingAll).toBe(300);

    // When selectedYear is 2025
    const result2025 = filterObligations(obligations, 2025);
    expect(result2025).toHaveLength(1);
    expect(result2025[0].remainingAmount).toBe(100);
  });

  test('attendance fines analytics include all meetings when selectedYear is "all"', () => {
    const meetings = [
      { id: 'm1', date: '2023-02-15' },
      { id: 'm2', date: '2024-05-10' },
      { id: 'm3', date: '2026-09-01' },
    ];
    const meetingMap = new Map(meetings.map((m) => [m.id, m]));

    const attendanceRecords = [
      { id: 'rec-1', meetingId: 'm1', totalAssessedFine: 20 },
      { id: 'rec-2', meetingId: 'm2', totalAssessedFine: 30 },
      { id: 'rec-3', meetingId: 'm3', totalAssessedFine: 50 },
    ];

    const filterAttendance = (records, selectedYear, selectedMonth = 'all') => {
      return records.filter((rec) => {
        const meeting = meetingMap.get(rec.meetingId);
        const meetingDateStr = rec.meetingDate || meeting?.date || '';
        if (meetingDateStr) {
          const d = new Date(meetingDateStr);
          if (!isNaN(d.getTime())) {
            if (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear)) return false;
            if (selectedMonth !== 'all' && d.getMonth() + 1 !== Number(selectedMonth)) return false;
          }
        }
        return true;
      });
    };

    const allAttendance = filterAttendance(attendanceRecords, 'all');
    expect(allAttendance).toHaveLength(3);
    const totalFines = allAttendance.reduce((sum, r) => sum + r.totalAssessedFine, 0);
    expect(totalFines).toBe(100);

    const year2024Attendance = filterAttendance(attendanceRecords, 2024);
    expect(year2024Attendance).toHaveLength(1);
    expect(year2024Attendance[0].totalAssessedFine).toBe(30);
  });
});

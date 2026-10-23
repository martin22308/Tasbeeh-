import { calculateDelayMinutes, calculateLateFee } from '../utils/lateFeeCalculator';

describe('Late Fee and Delay Calculator', () => {
  const defaultSettings = {
    gracePeriodMinutes: 5,
    feeIntervalMinutes: 5,
    feePerInterval: 10,
  };

  test('calculates delay minutes correctly for time strings', () => {
    expect(calculateDelayMinutes('19:00', '19:00')).toBe(0);
    expect(calculateDelayMinutes('19:00', '18:50')).toBe(0); // Early
    expect(calculateDelayMinutes('19:00', '19:05')).toBe(5);
    expect(calculateDelayMinutes('19:00', '19:06')).toBe(6);
    expect(calculateDelayMinutes('19:00', '19:11')).toBe(11);
    expect(calculateDelayMinutes('19:00', '19:15')).toBe(15);
  });

  test('calculates late fee according to specification examples', () => {
    // 7:00 PM arrival for a 7:00 PM meeting: 0 EGP
    expect(calculateLateFee(0, defaultSettings)).toBe(0);

    // 7:05 PM arrival: 0 EGP (within 5 min grace period)
    expect(calculateLateFee(5, defaultSettings)).toBe(0);

    // 7:06 PM arrival: 10 EGP (1 min billable -> ceil(1/5)*10 = 10)
    expect(calculateLateFee(6, defaultSettings)).toBe(10);

    // 7:10 PM arrival: 10 EGP (5 min billable -> ceil(5/5)*10 = 10)
    expect(calculateLateFee(10, defaultSettings)).toBe(10);

    // 7:11 PM arrival: 20 EGP (6 min billable -> ceil(6/5)*10 = 20)
    expect(calculateLateFee(11, defaultSettings)).toBe(20);

    // 7:15 PM arrival: 20 EGP (10 min billable -> ceil(10/5)*10 = 20)
    expect(calculateLateFee(15, defaultSettings)).toBe(20);

    // 7:16 PM arrival: 30 EGP (11 min billable -> ceil(11/5)*10 = 30)
    expect(calculateLateFee(16, defaultSettings)).toBe(30);
  });

  test('supports custom settings', () => {
    const customSettings = {
      gracePeriodMinutes: 10,
      feeIntervalMinutes: 10,
      feePerInterval: 15,
    };

    expect(calculateLateFee(10, customSettings)).toBe(0);
    expect(calculateLateFee(11, customSettings)).toBe(15);
    expect(calculateLateFee(20, customSettings)).toBe(15);
    expect(calculateLateFee(21, customSettings)).toBe(30);
  });
});

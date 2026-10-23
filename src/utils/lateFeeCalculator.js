/**
 * Calculate delay in minutes between scheduled meeting time and actual arrival time.
 * @param {string|Date} scheduledTime - e.g. "19:00" or full ISO date/time
 * @param {string|Date} arrivalTime - e.g. "19:11" or full ISO date/time
 * @param {string} [meetingDate] - optional date string YYYY-MM-DD
 * @returns {number} Delay in minutes (>= 0)
 */
export function calculateDelayMinutes(scheduledTime, arrivalTime, meetingDate = '') {
  if (!scheduledTime || !arrivalTime) return 0;

  // Handle format "HH:mm"
  if (typeof scheduledTime === 'string' && scheduledTime.includes(':') && !scheduledTime.includes('T')) {
    const [schedH, schedM] = scheduledTime.split(':').map(Number);
    const [arrH, arrM] = arrivalTime.split(':').map(Number);

    if (isNaN(schedH) || isNaN(schedM) || isNaN(arrH) || isNaN(arrM)) return 0;

    const schedTotal = schedH * 60 + schedM;
    const arrTotal = arrH * 60 + arrM;
    const diff = arrTotal - schedTotal;

    return Math.max(0, diff);
  }

  // Handle Date objects or ISO strings
  const schedDate = new Date(scheduledTime);
  const arrDate = new Date(arrivalTime);

  if (isNaN(schedDate.getTime()) || isNaN(arrDate.getTime())) return 0;

  const diffMs = arrDate.getTime() - schedDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  return Math.max(0, diffMinutes);
}

/**
 * Calculate late fee based on delay minutes and settings.
 * Billable Delay = max(0, Delay Minutes - Grace Period)
 * Late Fee = ceil(Billable Delay / Fee Interval) * Fee Per Interval
 * 
 * @param {number} delayMinutes
 * @param {object} settings
 * @param {number} [settings.gracePeriodMinutes=5]
 * @param {number} [settings.feeIntervalMinutes=5]
 * @param {number} [settings.feePerInterval=10]
 * @returns {number} Late fee in EGP
 */
export function calculateLateFee(delayMinutes, settings = {}) {
  const gracePeriod = Number(settings.gracePeriodMinutes ?? 5);
  const feeInterval = Number(settings.feeIntervalMinutes ?? 5);
  const feePerInterval = Number(settings.feePerInterval ?? 10);

  if (delayMinutes <= 0 || feeInterval <= 0) return 0;

  const billableDelay = Math.max(0, delayMinutes - gracePeriod);
  if (billableDelay <= 0) return 0;

  const intervals = Math.ceil(billableDelay / feeInterval);
  return intervals * feePerInterval;
}

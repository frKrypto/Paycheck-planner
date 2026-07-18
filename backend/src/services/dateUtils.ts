/**
 * Shared date utility functions for paycheck and bill projections.
 * Extracted from bills.ts to be reusable across routes.
 */

/**
 * Compute the next paycheck date based on the user's pay schedule.
 */
export function computeNextPaycheck(paySchedule: string, today: Date): Date {
  const next = new Date(today);

  switch (paySchedule) {
    case 'weekly': {
      // Next Monday (or today if Monday)
      const dayOfWeek = today.getDay(); // 0 = Sunday
      const daysUntilMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
      if (daysUntilMonday === 0) {
        return new Date(today);
      }
      next.setDate(today.getDate() + daysUntilMonday);
      return next;
    }

    case 'biweekly': {
      // 14 days from today
      next.setDate(today.getDate() + 14);
      return next;
    }

    case 'semi-monthly': {
      // Next 1st or 15th
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      if (currentDay < 15) {
        return new Date(currentYear, currentMonth, 15);
      } else {
        // After 15th — next 1st of next month
        return new Date(currentYear, currentMonth + 1, 1);
      }
    }

    default:
      // fallback: 14 days
      next.setDate(today.getDate() + 14);
      return next;
  }
}

/**
 * Compute the projected due date for a bill with a given day-of-month,
 * relative to a reference date (typically today).
 * If the due day has already passed this month, projects to next month.
 */
export function computeProjectedDueDate(dueDay: number, referenceDate: Date): string {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed

  // Clamp day to last day of month (handle 31 on 30-day months)
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const effectiveDay = Math.min(dueDay, lastDayOfMonth);

  const today = referenceDate.getDate();
  let targetMonth = month;
  let targetYear = year;

  if (effectiveDay < today) {
    // Due day already passed this month, use next month
    targetMonth = month + 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear = year + 1;
    }
  }

  // Re-clamp for the target month
  const targetLastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const finalDay = Math.min(dueDay, targetLastDay);

  const monthStr = String(targetMonth + 1).padStart(2, '0');
  const dayStr = String(finalDay).padStart(2, '0');
  return `${targetYear}-${monthStr}-${dayStr}`;
}

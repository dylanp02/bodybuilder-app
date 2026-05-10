// lib/planProjection.ts — derives future scheduled training dates from an active plan
import { TrainingPlan, DayCard, WeekDayKey, WeeklySchedule, CycleSchedule } from './types';
import { isoDate } from './utils';

const DOW_MAP: Record<number, WeekDayKey> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

export interface ProjectedDay { date: string; cards: DayCard[]; }

/**
 * Returns every date from today through (start_date + duration_weeks) that has at
 * least one non-rest card scheduled. For weekly plans, maps day-of-week to its
 * card list. For cycle plans, walks the cycle days in order from start_date.
 */
export function generateProjectedDates(plan: TrainingPlan): ProjectedDay[] {
  const result: ProjectedDay[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const planStart = parseLocal(plan.start_date);
  const planEnd   = new Date(planStart);
  planEnd.setDate(planEnd.getDate() + plan.duration_weeks * 7);

  // Start iterating from today or plan start, whichever is later
  let cursor = new Date(Math.max(today.getTime(), planStart.getTime()));

  if (plan.plan_type === 'weekly') {
    const sched = plan.schedule as WeeklySchedule;
    while (cursor <= planEnd) {
      const key   = DOW_MAP[cursor.getDay()];
      const cards = sched[key] ?? [];
      if (cards.some(c => c.category !== 'rest')) {
        result.push({ date: isoDate(cursor), cards });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const { days } = plan.schedule as CycleSchedule;
    if (!days.length) return result;

    // Determine which cycle day we're on by counting days elapsed from plan start
    const elapsed  = Math.floor((cursor.getTime() - planStart.getTime()) / 86400000);
    let cycleIdx   = elapsed % days.length;

    while (cursor <= planEnd) {
      const day = days[cycleIdx % days.length];
      if (day.cards.some(c => c.category !== 'rest')) {
        result.push({ date: isoDate(cursor), cards: day.cards });
      }
      cycleIdx++;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

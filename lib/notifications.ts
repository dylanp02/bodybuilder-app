/*
 * REQUIRES A DEVELOPMENT BUILD — expo-notifications is not fully supported in Expo Go.
 *
 * Starting with SDK 53, Expo Go removed remote push notification support on Android.
 * The import of expo-notifications itself triggers a warning/error in Expo Go because
 * the package auto-registers for a push token on load, even when only local notifications
 * are used. Local notification scheduling still works correctly in a development build.
 *
 * HOW TO ENABLE (development build):
 *   1. Install EAS CLI:      npm install -g eas-cli
 *   2. Log in:               eas login
 *   3. Configure:            eas build:configure
 *   4. Build for device:     eas build --profile development --platform android
 *                        or  eas build --profile development --platform ios
 *   5. Install the resulting .apk / .ipa on your device and point it at your
 *      running Metro server (expo start).
 *
 * WHILE IN EXPO GO:
 *   The scheduling calls become no-ops and the rest of the app works normally.
 *   The warning/error in the console is benign — it comes from expo-notifications
 *   attempting push-token registration, which is unrelated to local scheduling.
 *
 * Docs: https://docs.expo.dev/develop/development-builds/introduction/
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase, getCurrentUser } from './supabase';
import { TrainingPlan, DayCard, WeeklySchedule, CycleSchedule, WeekDayKey } from './types';
import { isoDate } from './utils';
import { getNotifPrefs, setNotifPrefs, NotifPrefs } from './notifPrefs';

const IDS_KEY = 'scheduled_notif_ids';
const LAST_SCHED_KEY = 'notif_last_scheduled';
const MAX_SLOTS = 58; // buffer below iOS 64 local notification cap

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── ID storage ────────────────────────────────────────────────────────────────

async function saveIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
}

async function loadIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  const ids = await loadIds();
  await Promise.all(ids.map(id =>
    Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
  ));
  await AsyncStorage.removeItem(IDS_KEY);
}

// ── Plan day enumeration ──────────────────────────────────────────────────────

const DOW: Record<number, WeekDayKey> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

interface PlanDay { date: string; isTraining: boolean; cards: DayCard[]; }

function getPlanDays(plan: TrainingPlan, limit: number): PlanDay[] {
  const result: PlanDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = plan.start_date.split('-').map(Number);
  const planStart = new Date(y, m - 1, d);
  planStart.setHours(0, 0, 0, 0);
  const planEnd = new Date(planStart);
  planEnd.setDate(planEnd.getDate() + plan.duration_weeks * 7);

  let cursor = new Date(Math.max(today.getTime(), planStart.getTime()));

  if (plan.plan_type === 'weekly') {
    const sched = plan.schedule as WeeklySchedule;
    while (cursor <= planEnd && result.length < limit) {
      const key = DOW[cursor.getDay()];
      const cards: DayCard[] = sched[key] ?? [];
      result.push({ date: isoDate(cursor), isTraining: cards.some(c => c.category !== 'rest'), cards });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const { days } = plan.schedule as CycleSchedule;
    if (!days.length) return result;
    const elapsed = Math.floor((cursor.getTime() - planStart.getTime()) / 86400000);
    let idx = elapsed % days.length;
    while (cursor <= planEnd && result.length < limit) {
      const day = days[idx % days.length];
      result.push({ date: isoDate(cursor), isTraining: day.cards.some(c => c.category !== 'rest'), cards: day.cards });
      idx++;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}

function trainingBody(cards: DayCard[]): string {
  const names = cards.filter(c => c.category !== 'rest').map(c => c.name).join(' · ');
  return names ? `${names} — let's get it done.` : 'Time to train.';
}

// ── Scheduling helpers ────────────────────────────────────────────────────────

async function scheduleAt(date: Date, title: string, body: string): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });
}

function atHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ── Core scheduling logic ─────────────────────────────────────────────────────

export async function scheduleAllNotifications(
  plan: TrainingPlan | null,
  lastWeightIso: string | null,
  prefs: NotifPrefs,
): Promise<void> {
  await cancelAllScheduledNotifications();
  if (!prefs.deviceEnabled || prefs.deviceMuted) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const ids: string[] = [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // 1. Bodyweight reminder — fire weekly when not logged in 5+ days
  const daysSince = lastWeightIso
    ? Math.floor((today.getTime() - new Date(lastWeightIso + 'T00:00:00').getTime()) / 86400000)
    : 999;

  if (daysSince >= 5 && ids.length < MAX_SLOTS) {
    // First occurrence: today if morning hasn't passed, else tomorrow
    const firstDay = new Date(today);
    if (atHour(today, prefs.morningHour) <= now) firstDay.setDate(firstDay.getDate() + 1);

    for (let week = 0; week < 8 && ids.length < MAX_SLOTS; week++) {
      const trigger = atHour(firstDay, prefs.morningHour);
      trigger.setDate(trigger.getDate() + week * 7);
      if (trigger > now) {
        ids.push(await scheduleAt(
          trigger,
          'Time to weigh in',
          'You haven\'t logged your bodyweight recently. Tap to track your progress.',
        ));
      }
    }
  }

  // 2. Training plan notifications
  if (plan) {
    const days = getPlanDays(plan, MAX_SLOTS);

    for (const day of days) {
      if (ids.length >= MAX_SLOTS) break;

      const [dy, dm, dd] = day.date.split('-').map(Number);
      const dayDate = new Date(dy, dm - 1, dd);

      if (day.isTraining) {
        // Morning (0600–1000 window, user-configurable within it)
        const morning = atHour(dayDate, prefs.morningHour);
        if (morning > now && ids.length < MAX_SLOTS) {
          ids.push(await scheduleAt(
            morning,
            'Today is a training day',
            trainingBody(day.cards),
          ));
        }
        // Afternoon (1300–1800 window, user-configurable within it)
        const afternoon = atHour(dayDate, prefs.afternoonHour);
        if (afternoon > now && ids.length < MAX_SLOTS) {
          ids.push(await scheduleAt(
            afternoon,
            'Still time to train',
            "The day isn't over — get your workout in before it ends.",
          ));
        }
      } else {
        // Rest day — morning only
        const morning = atHour(dayDate, prefs.morningHour);
        if (morning > now && ids.length < MAX_SLOTS) {
          ids.push(await scheduleAt(
            morning,
            'Rest day',
            'Scheduled rest. Fuel up, sleep well, and come back stronger.',
          ));
        }
      }
    }
  }

  await saveIds(ids);
}

// ── Main entry point — throttled to once per 24h ──────────────────────────────

export async function rescheduleNotifications(): Promise<void> {
  const lastRaw = await AsyncStorage.getItem(LAST_SCHED_KEY);
  if (lastRaw && Date.now() - new Date(lastRaw).getTime() < 86_400_000) return;
  await _doReschedule();
}

// Force re-schedule (bypasses 24h throttle — use after pref changes)
export async function forceRescheduleNotifications(): Promise<void> {
  await AsyncStorage.removeItem(LAST_SCHED_KEY);
  await _doReschedule();
}

async function _doReschedule(): Promise<void> {
  const prefs = await getNotifPrefs();

  if (!prefs.deviceEnabled || prefs.deviceMuted) {
    await cancelAllScheduledNotifications();
    return;
  }

  const user = await getCurrentUser();
  if (!user) return;

  const [planRes, weightRes] = await Promise.all([
    supabase
      .from('training_plans')
      .select('id, user_id, plan_type, plan_name, duration_weeks, start_date, schedule, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('weight_logs')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  await scheduleAllNotifications(
    planRes.data as TrainingPlan | null,
    weightRes.data?.date ?? null,
    prefs,
  );

  await AsyncStorage.setItem(LAST_SCHED_KEY, new Date().toISOString());
}


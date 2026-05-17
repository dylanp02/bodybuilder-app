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
 * Docs: https://docs.expo.dev/develop/development-builds/introduction/
 */
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { TrainingPlan, DayCard, WeeklySchedule, CycleSchedule, WeekDayKey } from './types';
import { isoDate } from './utils';
import { getNotifPrefs } from './notifPrefs';

const LAST_SCHED_KEY = 'notif_last_scheduled';
const CHANNEL_ID     = 'bodybuilderapp-reminders';
const MAX_TRAINING_DAYS = 14;

// ── Notification handler ───────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Channel setup ─────────────────────────────────────────────────────────────

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'LiftLedger Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6C47FF',
  });
}

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return status === 'granted';
}

// ── Push token registration ───────────────────────────────────────────────────

export async function registerPushToken(userId: string): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: tokenData } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: tokenData })
      .eq('id', userId);

    if (error) throw error;
    console.log('[Notifications] Push token registered');
  } catch (e) {
    console.log('[Notifications] Push token registration failed:', (e as Error).message);
    Sentry.captureException(e, { tags: { context: 'registerPushToken' } });
  }
}

// ── Cancel helpers ────────────────────────────────────────────────────────────

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(LAST_SCHED_KEY);
}

async function cancelBodyweightReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync('bodyweight-reminder').catch(() => {});
}

async function cancelTrainingNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(n => n.identifier.startsWith('training-'))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

// ── Internal plan-day enumeration ─────────────────────────────────────────────

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

function primaryCardNames(cards: DayCard[]): string {
  return cards.filter(c => c.category !== 'rest').map(c => c.name).join(' · ') || 'Training';
}

function atHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ── Bodyweight reminder ────────────────────────────────────────────────────────

export async function scheduleBodyweightReminder(userId: string): Promise<void> {
  await cancelBodyweightReminder();

  const { data } = await supabase
    .from('weight_logs')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSince = data?.date
    ? Math.floor((today.getTime() - new Date(data.date + 'T00:00:00').getTime()) / 86400000)
    : 999;

  if (daysSince < 5) return;

  const prefs = await getNotifPrefs();

  await Notifications.scheduleNotificationAsync({
    identifier: 'bodyweight-reminder',
    content: {
      title: 'Time to log your weight 📊',
      body: 'Keep your progress streak alive — log your weight today.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: (new Date().getDay() + 1) || 1,
      hour: prefs.morningHour,
      minute: 0,
    },
  });
}

// ── Training day notifications ────────────────────────────────────────────────

export async function scheduleTrainingNotifications(plan: TrainingPlan | null): Promise<void> {
  await cancelTrainingNotifications();
  if (!plan) return;

  const prefs = await getNotifPrefs();
  const days  = getPlanDays(plan, MAX_TRAINING_DAYS);
  const now   = new Date();

  for (const day of days) {
    const [dy, dm, dd] = day.date.split('-').map(Number);
    const dayDate = new Date(dy, dm - 1, dd);

    if (day.isTraining) {
      const names   = primaryCardNames(day.cards);
      const morning = atHour(dayDate, prefs.morningHour);
      if (morning > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `training-morning-${day.date}`,
          content: {
            title: `Today is a ${names} day 💪`,
            body: `${names} is on the plan — let's get it done.`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: morning,
          },
        });
      }

      const afternoon = atHour(dayDate, prefs.afternoonHour);
      if (afternoon > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `training-afternoon-${day.date}`,
          content: {
            title: 'Still time to train',
            body: `${names} is on the plan today — the day isn't over yet.`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: afternoon,
          },
        });
      }
    } else {
      const morning = atHour(dayDate, prefs.morningHour);
      if (morning > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: `training-morning-${day.date}`,
          content: {
            title: 'Rest day — recover well 🔄',
            body: 'Scheduled rest. Fuel up, sleep well, and come back stronger.',
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: morning,
          },
        });
      }
    }
  }
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export async function rescheduleNotifications(
  userId: string,
  plan: TrainingPlan | null,
): Promise<void> {
  const lastRaw = await AsyncStorage.getItem(LAST_SCHED_KEY);
  if (lastRaw && Date.now() - new Date(lastRaw).getTime() < 86_400_000) return;
  await _doReschedule(userId, plan);
}

export async function forceRescheduleNotifications(
  userId: string,
  plan: TrainingPlan | null,
): Promise<void> {
  await AsyncStorage.removeItem(LAST_SCHED_KEY);
  await _doReschedule(userId, plan);
}

async function _doReschedule(userId: string, plan: TrainingPlan | null): Promise<void> {
  const prefs = await getNotifPrefs();

  if (!prefs.deviceEnabled || prefs.deviceMuted) {
    await cancelAllScheduledNotifications();
    return;
  }

  const granted = await requestNotificationPermission();
  if (!granted) return;

  try {
    if (prefs.bodyweightEnabled) {
      await scheduleBodyweightReminder(userId);
    } else {
      await cancelBodyweightReminder();
    }

    if (prefs.trainingEnabled) {
      await scheduleTrainingNotifications(plan);
    } else {
      await cancelTrainingNotifications();
    }

    await AsyncStorage.setItem(LAST_SCHED_KEY, new Date().toISOString());
    console.log('[Notifications] Rescheduled');
  } catch (e) {
    console.log('[Notifications] Reschedule failed:', (e as Error).message);
    Sentry.captureException(e, { tags: { context: '_doReschedule' } });
  }
}

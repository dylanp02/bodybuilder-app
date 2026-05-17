import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotifPrefs {
  deviceEnabled: boolean;
  deviceMuted: boolean;
  mutedUntil: string | null; // ISO timestamp; null = indefinite or not muted
  morningHour: number;       // 6–10, default 7
  afternoonHour: number;     // 13–18, default 15
  bodyweightEnabled: boolean;
  trainingEnabled: boolean;
}

const KEY = 'notif_prefs';

const DEFAULTS: NotifPrefs = {
  deviceEnabled: true,
  deviceMuted: false,
  mutedUntil: null,
  morningHour: 7,
  afternoonHour: 15,
  bodyweightEnabled: true,
  trainingEnabled: true,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: NotifPrefs = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };

    // Auto-expire timed mutes
    if (parsed.deviceMuted && parsed.mutedUntil && new Date(parsed.mutedUntil) <= new Date()) {
      parsed.deviceMuted = false;
      parsed.mutedUntil = null;
      await AsyncStorage.setItem(KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setNotifPrefs(updates: Partial<NotifPrefs>): Promise<void> {
  const current = await getNotifPrefs();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...updates }));
}

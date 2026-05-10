import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotifPrefs {
  deviceEnabled: boolean;
  deviceMuted: boolean;
  emailEnabled: boolean;
  morningHour: number;   // 6–10, default 7
  afternoonHour: number; // 13–18, default 15
}

const KEY = 'notif_prefs';

const DEFAULTS: NotifPrefs = {
  deviceEnabled: true,
  deviceMuted: false,
  emailEnabled: false,
  morningHour: 7,
  afternoonHour: 15,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setNotifPrefs(updates: Partial<NotifPrefs>): Promise<void> {
  const current = await getNotifPrefs();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...updates }));
}

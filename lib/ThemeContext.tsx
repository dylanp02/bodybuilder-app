// lib/ThemeContext.tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors, AppColors } from '../constants/theme';

const STORAGE_KEY_THEME = '@app_isDark';
const STORAGE_KEY_UNITS = '@app_isMetric';

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  isMetric: boolean;
  toggleTheme: () => void;
  setMetric: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: DarkColors,
  isDark: true,
  isMetric: false,
  toggleTheme: () => {},
  setMetric: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [isMetric, setIsMetric] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY_THEME, STORAGE_KEY_UNITS]).then(pairs => {
      const darkVal = pairs[0][1];
      const metricVal = pairs[1][1];
      if (darkVal !== null) setIsDark(darkVal === 'true');
      if (metricVal !== null) setIsMetric(metricVal === 'true');
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY_THEME, String(next));
      return next;
    });
  }, []);

  const setMetric = useCallback((v: boolean) => {
    setIsMetric(v);
    AsyncStorage.setItem(STORAGE_KEY_UNITS, String(v));
  }, []);

  const colors = isDark ? DarkColors : LightColors;

  const value = useMemo(
    () => ({ colors, isDark, isMetric, toggleTheme, setMetric }),
    [colors, isDark, isMetric, toggleTheme, setMetric]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';
import { supabase, getCurrentUser } from './supabase';
import { DEV_PRO_UNLOCKED } from './proAccess';

interface ProContextValue {
  isPro: boolean;
  refreshPro: () => Promise<void>;
}

const ProContext = createContext<ProContextValue>({
  isPro: DEV_PRO_UNLOCKED,
  refreshPro: async () => {},
});

export function ProContextProvider({ children }: { children: React.ReactNode }) {
  // DEV_PRO_UNLOCKED short-circuits everything — always pro in dev override mode
  const [isPro, setIsPro] = useState(DEV_PRO_UNLOCKED);
  const appStateRef = useRef(AppState.currentState);

  const fetchIsPro = useCallback(async () => {
    if (DEV_PRO_UNLOCKED) return;
    const user = await getCurrentUser();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .single();
    // Only update if data returned — on error data is null, isPro stays false (safe default)
    if (data != null) setIsPro(data.is_pro);
  }, []);

  // Debug: log whenever isPro resolves or changes
  useEffect(() => {
    console.log('[ProContext] isPro:', isPro);
  }, [isPro]);

  useEffect(() => {
    if (DEV_PRO_UNLOCKED) return;

    // Initialize RevenueCat with the Supabase user UID as the app user ID so
    // purchases are tied to the account across devices and platforms.
    // NOTE: For production builds you will need separate iOS/Android API keys
    // via Platform.select — the current key is the shared test key.
    const apiKey = Constants.expoConfig?.extra?.revenueCatApiKey as string | undefined;
    if (apiKey) {
      getCurrentUser().then(user => {
        if (!user) return;
        try {
          Purchases.configure({ apiKey, appUserID: user.id });
        } catch {
          // Native module not available in Expo Go — safe to ignore
        }
      });
    }

    fetchIsPro();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        fetchIsPro();
      }
      appStateRef.current = next;
    });

    return () => sub.remove();
  }, [fetchIsPro]);

  return (
    <ProContext.Provider value={{ isPro, refreshPro: fetchIsPro }}>
      {children}
    </ProContext.Provider>
  );
}

export function useProContext(): ProContextValue {
  return useContext(ProContext);
}

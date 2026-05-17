// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Linking, View, Text, StyleSheet, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';
import { ProContextProvider } from '../lib/ProContext';
import ProBanner from '../components/ProBanner';
import { setupNotificationChannel, registerPushToken, rescheduleNotifications } from '../lib/notifications';
import { TrainingPlan } from '../lib/types';

const dsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

function handleAuthUrl(url: string) {
  // PKCE flow (Supabase v2 default): bodybuilderapp://?code=xxx
  const codeMatch = url.match(/[?&]code=([^&]+)/);
  if (codeMatch) {
    supabase.auth.exchangeCodeForSession(decodeURIComponent(codeMatch[1]));
    return;
  }
  // Implicit flow fallback: bodybuilderapp://#access_token=xxx&refresh_token=yyy
  const atMatch = url.match(/access_token=([^&]+)/);
  const rtMatch = url.match(/refresh_token=([^&]+)/);
  if (atMatch && rtMatch) {
    supabase.auth.setSession({
      access_token: decodeURIComponent(atMatch[1]),
      refresh_token: decodeURIComponent(rtMatch[1]),
    });
  }
}

function RootLayoutInner() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    setupNotificationChannel();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Enforce "keep me signed in" preference set at login.
      // If the user unchecked it, sign them out on every cold launch.
      if (session) {
        const pref = await AsyncStorage.getItem('keep_logged_in');
        if (pref === 'false') {
          await AsyncStorage.removeItem('keep_logged_in');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }
      setSession(session);
      if (!session) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          setOnboardingComplete(null);
          setLoading(false);
        }
      }
    );

    Linking.getInitialURL().then(url => { if (url) handleAuthUrl(url); });
    const linkSub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  // Check onboarding status whenever the authenticated user changes
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setOnboardingComplete(data?.onboarding_complete ?? false);
        setLoading(false);
      });
    // Register push token and reschedule notifications on every authenticated launch.
    registerPushToken(session.user.id);

    supabase
      .from('training_plans')
      .select('id, user_id, plan_type, plan_name, duration_weeks, start_date, schedule, is_active')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data: plan }) => {
        rescheduleNotifications(session.user.id, plan as TrainingPlan | null);
      });
  }, [session?.user?.id]);

  if (loading) return null;

  // Determine which root screen to show
  let screenName: string;
  if (!session) {
    screenName = 'auth';
  } else if (onboardingComplete) {
    screenName = '(tabs)';
  } else {
    screenName = 'onboarding';
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Black bar fills the system status bar area (time / notifications / battery) */}
      <StatusBar style="light" backgroundColor="#000" translucent />
      <View style={{ height: insets.top, backgroundColor: '#000' }} />
      {/* Key by user ID so ProContextProvider remounts (and re-initialises RC) on login/logout */}
      <ProContextProvider key={session?.user?.id ?? 'no-user'}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {screenName === '(tabs)' && <ProBanner />}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name={screenName} />
          </Stack>
        </View>
      </ProContextProvider>
    </View>
  );
}

function ErrorFallback() {
  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.body}>Please restart the app.</Text>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#999',
    fontSize: 15,
    textAlign: 'center',
  },
});

function RootLayout() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);

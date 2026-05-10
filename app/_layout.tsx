// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ThemeProvider, useTheme } from '../lib/ThemeContext';

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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

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
    <>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name={screenName} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

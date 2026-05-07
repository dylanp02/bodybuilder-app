// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

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

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    // Cold start: app was opened by tapping the confirmation link
    Linking.getInitialURL().then(url => { if (url) handleAuthUrl(url); });

    // Warm open: confirmation link tapped while app is already running
    const linkSub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));

    return () => {
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {session ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="auth" />
      )}
    </Stack>
  );
}
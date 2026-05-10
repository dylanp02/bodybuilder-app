// app/auth.tsx
import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useColors } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';

export default function AuthScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert('Sign in failed', error.message);
      } else {
        // Persist the user's "keep me signed in" preference.
        // _layout.tsx reads this on next launch — if false, it signs out immediately.
        await AsyncStorage.setItem('keep_logged_in', keepLoggedIn ? 'true' : 'false');
      }
      // Routing handled reactively by app/_layout.tsx via onAuthStateChange
    } else {
      // ⚠️  EMAIL CONFIRMATION IS CURRENTLY DISABLED FOR TESTING.
      // Before going to production, re-enable it in the Supabase dashboard:
      //   Authentication → Providers → Email → "Confirm email" toggle ON
      // When enabled, signUp will NOT return a session immediately — the user
      // must click the confirmation link first. You will also need to restore
      // a "Check your email" Alert and handle the unauthenticated state.
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        Alert.alert('Sign up failed', error.message);
      } else {
        await AsyncStorage.setItem('keep_logged_in', keepLoggedIn ? 'true' : 'false');
      }
      // On success: session fires immediately (confirmation disabled),
      // _layout.tsx routes new users to onboarding automatically.
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>BodybuilderApp</Text>
        <Text style={styles.subtitle}>
          {isLogin ? 'Sign in to your account' : 'Create your account'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textDisabled}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textDisabled}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType={isLogin ? 'password' : 'newPassword'}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
        />

        {/* Keep me signed in */}
        <Pressable style={styles.checkRow} onPress={() => setKeepLoggedIn(v => !v)}>
          <View style={[styles.checkbox, keepLoggedIn && styles.checkboxActive]}>
            {keepLoggedIn && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>Keep me signed in</Text>
        </Pressable>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
          </Text>
        </Pressable>

        <Pressable onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.toggleText}>
            {isLogin
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, justifyContent: 'center', padding: Spacing.xl },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.md,
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.lg,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  checkLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  button: {
    backgroundColor: Colors.primary, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center', marginBottom: Spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  toggleText: { color: Colors.primary, fontSize: FontSize.sm, textAlign: 'center' },
});

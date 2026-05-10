/*
 * SQL — run once in Supabase Dashboard → SQL Editor before deploying this flow:
 *
 *   ALTER TABLE profiles
 *     ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;
 *
 * How the gate works (app/_layout.tsx):
 *   - Session present + onboarding_complete = false  → routes here (step-name)
 *   - Session present + onboarding_complete = true   → routes to (tabs)
 *   - No session                                     → routes to auth
 *
 * Each step upserts its data to `profiles` immediately on Continue so progress
 * is never lost if the user backgrounds the app mid-flow.
 */
import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { useColors } from '../../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../../constants/theme';

export default function StepNameScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    const name = fullName.trim();
    const uname = username.trim().toLowerCase();

    if (!name) { Alert.alert('Enter your name'); return; }
    if (!uname) { Alert.alert('Choose a username'); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
      Alert.alert('Invalid username', 'Use 3–20 characters: letters, numbers, and underscores only.');
      return;
    }

    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, full_name: name, username: uname }, { onConflict: 'id' });

    setSaving(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('unique') || msg.includes('duplicate')) {
        Alert.alert('Username taken', 'Try a different username.');
      } else {
        Alert.alert('Error', error.message);
      }
      return;
    }

    router.push('/onboarding/step-stats');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StepDots current={1} Colors={Colors} />

        <Text style={styles.heading}>Welcome</Text>
        <Text style={styles.sub}>Set up your profile in a few quick steps.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Alex Johnson"
            placeholderTextColor={Colors.textDisabled}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.usernameRow}>
            <View style={styles.atBadge}>
              <Text style={styles.atSign}>@</Text>
            </View>
            <TextInput
              style={[styles.input, styles.flex]}
              placeholder="alex_lifts"
              placeholderTextColor={Colors.textDisabled}
              value={username}
              onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.hint}>3–20 characters: letters, numbers, underscores</Text>
        </View>

        <Pressable
          style={[styles.primaryBtn, saving && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Continue'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepDots({ current, Colors }: { current: number; Colors: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: Spacing.xl }}>
      {[1, 2, 3, 4].map(n => (
        <View
          key={n}
          style={{
            height: 8, borderRadius: 4,
            width: n === current ? 24 : 8,
            backgroundColor: n <= current ? Colors.primary : Colors.border,
            opacity: n < current ? 0.5 : 1,
          }}
        />
      ))}
    </View>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1, backgroundColor: Colors.background,
    padding: Spacing.lg, paddingTop: Spacing.xxl,
  },
  heading: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  sub: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  field: { marginBottom: Spacing.lg },
  label: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  atBadge: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  atSign: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600' },
  hint: { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: Spacing.xs },
  primaryBtn: {
    backgroundColor: Colors.primary, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});

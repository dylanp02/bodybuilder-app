// app/account.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../lib/supabase';
import { useColors } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';

export default function AccountScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const user = await getCurrentUser();
    if (!user) return;
    setEmail(user.email ?? '');
    const { data } = await supabase
      .from('profiles')
      .select('username, full_name')
      .eq('id', user.id)
      .single();
    if (data) {
      setFullName(data.full_name ?? '');
      setUsername(data.username ?? '');
    }
    setLoading(false);
  };

  const updateEmail = async () => {
    if (!newEmail.trim()) { Alert.alert('Enter a new email address'); return; }
    setUpdatingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setUpdatingEmail(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Check your inbox', 'Confirm the new address to complete the change.');
      setShowEmailForm(false);
      setNewEmail('');
    }
  };

  const updatePassword = async () => {
    if (!newPassword) { Alert.alert('Enter a new password'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Passwords do not match'); return; }
    if (newPassword.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Password updated');
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const avatarLabel = (fullName || username || '?').charAt(0).toUpperCase();
  const displayName = fullName || username || 'Athlete';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLabel}</Text>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        {username ? <Text style={styles.usernameText}>@{username}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Email</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoValue} numberOfLines={1}>{email}</Text>
          <Pressable onPress={() => { setShowEmailForm(v => !v); setShowPasswordForm(false); }}>
            <Text style={styles.actionLink}>{showEmailForm ? 'Cancel' : 'Update'}</Text>
          </Pressable>
        </View>
        {showEmailForm && (
          <View style={styles.formBlock}>
            <TextInput
              style={styles.input}
              placeholder="New email address"
              placeholderTextColor={Colors.textDisabled}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <Pressable
              style={[styles.primaryButton, updatingEmail && styles.buttonDisabled]}
              onPress={updateEmail}
              disabled={updatingEmail}
            >
              <Text style={styles.primaryButtonText}>
                {updatingEmail ? 'Sending...' : 'Send Confirmation'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Password</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoValue}>••••••••</Text>
          <Pressable onPress={() => { setShowPasswordForm(v => !v); setShowEmailForm(false); }}>
            <Text style={styles.actionLink}>{showPasswordForm ? 'Cancel' : 'Update'}</Text>
          </Pressable>
        </View>
        {showPasswordForm && (
          <View style={styles.formBlock}>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor={Colors.textDisabled}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.textDisabled}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <Pressable
              style={[styles.primaryButton, updatingPassword && styles.buttonDisabled]}
              onPress={updatePassword}
              disabled={updatingPassword}
            >
              <Text style={styles.primaryButtonText}>
                {updatingPassword ? 'Updating...' : 'Update Password'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const AVATAR_SIZE = 64;

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },

  profileHeader: { alignItems: 'center', marginBottom: Spacing.xl },
  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: { color: '#fff', fontSize: FontSize.xl, fontWeight: '700' },
  displayName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  usernameText: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoValue: { fontSize: FontSize.md, color: Colors.text, flex: 1, marginRight: Spacing.md },
  actionLink: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  formBlock: { marginTop: Spacing.md },
  input: {
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.md,
  },
  primaryButton: {
    backgroundColor: Colors.primary, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },
});

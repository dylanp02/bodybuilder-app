// app/settings.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';

export default function SettingsScreen() {
  const { colors: Colors, isDark, isMetric, toggleTheme, setMetric } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Units</Text>
        <Text style={styles.rowSub}>Used for weights and measurements</Text>
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segHalf, styles.segLeft, !isMetric && styles.segActive]}
            onPress={() => setMetric(false)}
          >
            <Text style={[styles.segText, !isMetric && styles.segTextActive]}>Imperial</Text>
            <Text style={[styles.segSubText, !isMetric && styles.segSubTextActive]}>lbs, in</Text>
          </Pressable>
          <Pressable
            style={[styles.segHalf, styles.segRight, isMetric && styles.segActive]}
            onPress={() => setMetric(true)}
          >
            <Text style={[styles.segText, isMetric && styles.segTextActive]}>Metric</Text>
            <Text style={[styles.segSubText, isMetric && styles.segSubTextActive]}>kg, cm</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notifications</Text>
        <Pressable style={styles.navRow} onPress={() => router.push('/notifications')}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>Notification preferences</Text>
            <Text style={styles.rowSub}>Device reminders, mute, and email settings</Text>
          </View>
          <Text style={styles.navChevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Text style={styles.rowSub}>Changes immediately</Text>
          </View>
          <Switch
            value={!isDark}
            onValueChange={() => toggleTheme()}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  title: {
    fontSize: FontSize.xl, fontWeight: '700',
    color: Colors.text, marginBottom: Spacing.xl,
  },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionLabel: {
    fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flex: 1, marginRight: Spacing.md },
  rowTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navChevron: { fontSize: 22, color: Colors.textDisabled, lineHeight: 26 },

  // Segmented control
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  segHalf: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  segLeft: { borderRightWidth: 1, borderRightColor: Colors.border },
  segRight: {},
  segActive: { backgroundColor: Colors.primary },
  segText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  segTextActive: { color: '#fff' },
  segSubText: { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
  segSubTextActive: { color: 'rgba(255,255,255,0.75)' },
});

// app/settings.tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, ScrollView } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

const KEYS = { units: 'settings_units', theme: 'settings_theme' };

export default function SettingsScreen() {
  const [useMetric, setUseMetric] = useState(false);
  const [useLightMode, setUseLightMode] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [units, theme] = await Promise.all([
      AsyncStorage.getItem(KEYS.units),
      AsyncStorage.getItem(KEYS.theme),
    ]);
    setUseMetric(units === 'metric');
    setUseLightMode(theme === 'light');
  };

  const toggleUnits = async (val: boolean) => {
    setUseMetric(val);
    await AsyncStorage.setItem(KEYS.units, val ? 'metric' : 'imperial');
  };

  const toggleTheme = async (val: boolean) => {
    setUseLightMode(val);
    await AsyncStorage.setItem(KEYS.theme, val ? 'light' : 'dark');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Units</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>
              {useMetric ? 'Metric (kg, cm)' : 'Imperial (lbs, in)'}
            </Text>
            <Text style={styles.rowSub}>Used for weights and measurements</Text>
          </View>
          <Switch
            value={useMetric}
            onValueChange={toggleUnits}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>
              {useLightMode ? 'Light Mode' : 'Dark Mode'}
            </Text>
            <Text style={styles.rowSub}>Restart the app to apply theme changes</Text>
          </View>
          <Switch
            value={useLightMode}
            onValueChange={toggleTheme}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flex: 1, marginRight: Spacing.md },
  rowTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});

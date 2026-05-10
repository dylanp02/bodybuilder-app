import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, getCurrentUser } from '../../lib/supabase';
import { useTheme } from '../../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../../constants/theme';
import { todayIso } from '../../lib/utils';

export default function StepStatsScreen() {
  const { colors: Colors, isMetric, setMetric } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const [cm, setCm] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    let heightInches: number | null = null;
    let weightLbs: number | null = null;

    if (isMetric) {
      const cmVal = parseFloat(cm);
      if (!cm || isNaN(cmVal) || cmVal < 50 || cmVal > 280) {
        Alert.alert('Invalid height', 'Enter a height between 50–280 cm.'); return;
      }
      heightInches = Math.round(cmVal / 2.54);
    } else {
      const ft = parseInt(feet, 10);
      const ins = parseInt(inches || '0', 10);
      if (!feet || isNaN(ft) || ft < 3 || ft > 8) {
        Alert.alert('Invalid height', 'Enter feet between 3–8.'); return;
      }
      if (isNaN(ins) || ins < 0 || ins > 11) {
        Alert.alert('Invalid height', 'Enter inches between 0–11.'); return;
      }
      heightInches = ft * 12 + ins;
    }

    if (isMetric) {
      const kg = parseFloat(weight);
      if (!weight || isNaN(kg) || kg < 20 || kg > 400) {
        Alert.alert('Invalid weight', 'Enter a weight between 20–400 kg.'); return;
      }
      weightLbs = Math.round(kg * 2.20462 * 10) / 10;
    } else {
      const lbs = parseFloat(weight);
      if (!weight || isNaN(lbs) || lbs < 50 || lbs > 900) {
        Alert.alert('Invalid weight', 'Enter a weight between 50–900 lbs.'); return;
      }
      weightLbs = lbs;
    }

    setSaving(true);
    const user = await getCurrentUser();
    if (!user) { setSaving(false); return; }

    const [profileRes, logRes] = await Promise.all([
      supabase.from('profiles')
        .update({ height_inches: heightInches, weight_lbs: weightLbs })
        .eq('id', user.id),
      supabase.from('weight_logs').upsert(
        { user_id: user.id, date: todayIso(), weight_lbs: weightLbs },
        { onConflict: 'user_id,date' },
      ),
    ]);

    setSaving(false);
    const err = profileRes.error || logRes.error;
    if (err) { Alert.alert('Error', err.message); return; }

    router.push('/onboarding/step-goals');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <StepDots current={2} Colors={Colors} />

        <Text style={styles.heading}>Your Body Stats</Text>
        <Text style={styles.sub}>Used to personalise your experience. You can update these later.</Text>

        {/* Unit toggle */}
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segHalf, styles.segLeft, !isMetric && styles.segActive]}
            onPress={() => setMetric(false)}
          >
            <Text style={[styles.segText, !isMetric && styles.segTextActive]}>Imperial</Text>
            <Text style={[styles.segSub, !isMetric && styles.segSubActive]}>lbs, ft/in</Text>
          </Pressable>
          <Pressable
            style={[styles.segHalf, styles.segRight, isMetric && styles.segActive]}
            onPress={() => setMetric(true)}
          >
            <Text style={[styles.segText, isMetric && styles.segTextActive]}>Metric</Text>
            <Text style={[styles.segSub, isMetric && styles.segSubActive]}>kg, cm</Text>
          </Pressable>
        </View>

        {/* Height */}
        <View style={styles.field}>
          <Text style={styles.label}>Height</Text>
          {isMetric ? (
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.flex]}
                placeholder="175"
                placeholderTextColor={Colors.textDisabled}
                value={cm}
                onChangeText={setCm}
                keyboardType="decimal-pad"
              />
              <Text style={styles.unit}>cm</Text>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputShort]}
                placeholder="5"
                placeholderTextColor={Colors.textDisabled}
                value={feet}
                onChangeText={setFeet}
                keyboardType="number-pad"
                maxLength={1}
              />
              <Text style={styles.unit}>ft</Text>
              <TextInput
                style={[styles.input, styles.inputShort]}
                placeholder="10"
                placeholderTextColor={Colors.textDisabled}
                value={inches}
                onChangeText={setInches}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.unit}>in</Text>
            </View>
          )}
        </View>

        {/* Weight */}
        <View style={styles.field}>
          <Text style={styles.label}>Current Bodyweight</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.flex]}
              placeholder={isMetric ? '80' : '175'}
              placeholderTextColor={Colors.textDisabled}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
            <Text style={styles.unit}>{isMetric ? 'kg' : 'lbs'}</Text>
          </View>
          <Text style={styles.hint}>This will be recorded as your first bodyweight entry.</Text>
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
    padding: Spacing.lg, paddingTop: Spacing.xl,
  },
  back: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  heading: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  sub: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  field: { marginBottom: Spacing.lg },
  label: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: FontSize.md,
  },
  inputShort: { width: 72 },
  unit: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '500' },
  hint: { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: Spacing.xs },
  segmented: {
    flexDirection: 'row', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginBottom: Spacing.xl,
  },
  segHalf: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', backgroundColor: Colors.surfaceAlt },
  segLeft: { borderRightWidth: 1, borderRightColor: Colors.border },
  segRight: {},
  segActive: { backgroundColor: Colors.primary },
  segText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  segTextActive: { color: '#fff' },
  segSub: { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
  segSubActive: { color: 'rgba(255,255,255,0.75)' },
  primaryBtn: {
    backgroundColor: Colors.primary, padding: Spacing.md,
    borderRadius: Radius.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});

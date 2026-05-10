// app/subscription.tsx
// Subscription page — UI only. Payment processing not yet active.
// DEV_PRO_UNLOCKED = true in lib/proAccess.ts keeps all features accessible during development.
import { useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useColors } from '../lib/ThemeContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';
import { DEV_PRO_UNLOCKED } from '../lib/proAccess';

// ── Pricing ──────────────────────────────────────────────────────────────────
// Monthly:   $6.99 / month
// 6 Months:  $24.99 total → $4.17 / month  → saves ~40% vs monthly
// Yearly:    $39.99 total → $3.33 / month  → saves ~52% vs monthly
const PLANS = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$6.99',
    period: 'per month',
    monthlyEquiv: '$6.99 / mo',
    badge: null,
    saving: null,
  },
  {
    id: 'biannual',
    label: '6 Months',
    price: '$24.99',
    period: 'every 6 months',
    monthlyEquiv: '$4.17 / mo',
    badge: 'POPULAR',
    saving: '40% off',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    price: '$39.99',
    period: 'per year',
    monthlyEquiv: '$3.33 / mo',
    badge: 'BEST VALUE',
    saving: '52% off',
  },
] as const;

const CURRENT_FEATURES = [
  'Body measurements tracking (neck, chest, waist, hips, and more)',
  'Workout template builder — create and save custom templates',
];

const FUTURE_FEATURES = [
  'Progress photo timeline with side-by-side comparison',
  '1RM calculator and tracking over time',
  'Workout streaks and scoring',
  'Post-workout notes and RPE calculator',
  'Full workout history CSV export',
];

export default function SubscriptionScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);

  const handleSubscribe = (planLabel: string) => {
    Alert.alert(
      'Coming Soon',
      `${planLabel} subscription will be available at launch. All Pro features are currently unlocked for development.`,
      [{ text: 'OK' }],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Pro Plan</Text>
      <Text style={styles.subtitle}>Unlock the full experience</Text>

      {/* Dev mode banner */}
      {DEV_PRO_UNLOCKED && (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>
            DEV MODE — All Pro features are currently unlocked for testing.
            Subscription is not yet active.
          </Text>
        </View>
      )}

      {/* Pricing tiers */}
      {PLANS.map(plan => (
        <View key={plan.id} style={[styles.planCard, plan.id === 'yearly' && styles.planCardHighlight]}>
          <View style={styles.planTop}>
            <View style={styles.planLeft}>
              <View style={styles.planLabelRow}>
                <Text style={[styles.planLabel, plan.id === 'yearly' && styles.planLabelHighlight]}>
                  {plan.label}
                </Text>
                {plan.badge && (
                  <View style={[styles.badge, plan.id === 'yearly' && styles.badgeHighlight]}>
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.monthlyEquiv}>{plan.monthlyEquiv}</Text>
            </View>
            <View style={styles.planRight}>
              <Text style={[styles.price, plan.id === 'yearly' && styles.priceHighlight]}>
                {plan.price}
              </Text>
              <Text style={styles.period}>{plan.period}</Text>
              {plan.saving && (
                <Text style={styles.saving}>{plan.saving}</Text>
              )}
            </View>
          </View>

          <Pressable
            style={[styles.subscribeBtn, plan.id === 'yearly' && styles.subscribeBtnHighlight]}
            onPress={() => handleSubscribe(plan.label)}
          >
            <Text style={[styles.subscribeBtnText, plan.id === 'yearly' && styles.subscribeBtnTextHighlight]}>
              Subscribe — {plan.price}
            </Text>
          </Pressable>
        </View>
      ))}

      {/* Current Pro features */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>What's Included</Text>
        {CURRENT_FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureCheck}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Planned features */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Coming Soon — Included at No Extra Cost</Text>
        <Text style={styles.sectionSub}>
          These features are in development. Pro subscribers get automatic access when they launch.
        </Text>
        <Text style={styles.categoryLabel}>Tracking &amp; Analytics</Text>
        {FUTURE_FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureSoon}>◦</Text>
            <Text style={styles.featureTextMuted}>{f}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.legalNote}>
        Prices shown in USD. Cancel anytime. Billing handled through the App Store / Google Play.
        Subscription management not yet active.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  backButton: { marginBottom: Spacing.lg },
  backText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },

  devBanner: {
    backgroundColor: Colors.warning + '22',
    borderWidth: 1, borderColor: Colors.warning,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  devBannerText: { fontSize: FontSize.sm, color: Colors.warning, fontWeight: '600' },

  planCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, marginBottom: Spacing.md,
  },
  planCardHighlight: { borderColor: Colors.primary, borderWidth: 2 },

  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  planLeft: { flex: 1 },
  planLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  planLabel: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  planLabelHighlight: { color: Colors.primary },
  monthlyEquiv: { fontSize: FontSize.sm, color: Colors.textSecondary },
  planRight: { alignItems: 'flex-end' },
  price: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  priceHighlight: { color: Colors.primary },
  period: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  saving: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '700', marginTop: 4 },

  badge: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeHighlight: { backgroundColor: Colors.primary },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.text },

  subscribeBtn: {
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  subscribeBtnHighlight: { backgroundColor: Colors.primary },
  subscribeBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  subscribeBtnTextHighlight: { color: '#fff' },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, marginBottom: Spacing.md, marginTop: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs,
  },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  categoryLabel: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.text,
    marginBottom: Spacing.sm, marginTop: Spacing.xs,
  },
  featureRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, alignItems: 'flex-start' },
  featureCheck: { fontSize: FontSize.md, color: Colors.success, fontWeight: '700', lineHeight: 22 },
  featureSoon: { fontSize: FontSize.lg, color: Colors.textDisabled, lineHeight: 22 },
  featureText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  featureTextMuted: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  legalNote: {
    fontSize: FontSize.xs, color: Colors.textDisabled,
    textAlign: 'center', marginTop: Spacing.md, lineHeight: 18,
  },
});

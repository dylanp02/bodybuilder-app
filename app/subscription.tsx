import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Purchases, { PurchasesPackage, PurchasesError } from 'react-native-purchases';

const PACKAGE_TYPE = Purchases.PACKAGE_TYPE;
const PURCHASES_ERROR_CODE = Purchases.PURCHASES_ERROR_CODE;
import { useColors } from '../lib/ThemeContext';
import { useProContext } from '../lib/ProContext';
import { type AppColors, Spacing, FontSize, Radius } from '../constants/theme';

// ── Package metadata helpers ──────────────────────────────────────────────────

function pkgLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.WEEKLY:      return 'Weekly';
    case PACKAGE_TYPE.MONTHLY:     return 'Monthly';
    case PACKAGE_TYPE.THREE_MONTH: return '3 Months';
    case PACKAGE_TYPE.SIX_MONTH:  return '6 Months';
    case PACKAGE_TYPE.ANNUAL:      return 'Yearly';
    default:                      return pkg.product.title;
  }
}

function pkgBadge(pkg: PurchasesPackage): string | null {
  if (pkg.packageType === PACKAGE_TYPE.SIX_MONTH) return 'POPULAR';
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'BEST VALUE';
  return null;
}

function pkgMonthlyEquiv(pkg: PurchasesPackage): string | null {
  const p = pkg.product.price;
  const sym = pkg.product.currencyCode === 'USD' ? '$' : pkg.product.currencyCode + ' ';
  switch (pkg.packageType) {
    case PACKAGE_TYPE.ANNUAL:      return `${sym}${(p / 12).toFixed(2)} / mo`;
    case PACKAGE_TYPE.SIX_MONTH:  return `${sym}${(p / 6).toFixed(2)} / mo`;
    case PACKAGE_TYPE.THREE_MONTH: return `${sym}${(p / 3).toFixed(2)} / mo`;
    default: return null;
  }
}

function isHighlighted(pkg: PurchasesPackage): boolean {
  return pkg.packageType === PACKAGE_TYPE.ANNUAL;
}

// ── Static feature lists ──────────────────────────────────────────────────────

const CURRENT_FEATURES = [
  'Body measurements tracking (neck, chest, waist, hips, and more)',
  'Workout template builder — create and save custom templates',
  'Training plan builder with weekly and cycle-based programming',
];

const FUTURE_FEATURES = [
  'Progress photo timeline with side-by-side comparison',
  'Creator-curated training plans for popular goals (strength, hypertrophy, fat loss, etc.)',
  '1RM calculator and tracking over time',
  'Workout streaks and scoring',
  'Post-workout notes and RPE calculator',
  'Full workout history CSV export',
];

// ── Screen ────────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'error' | 'ready';

export default function SubscriptionScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { isPro, refreshPro } = useProContext();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null); // identifier of pkg in-flight
  const [restoring, setRestoring] = useState(false);

  const loadOfferings = useCallback(async () => {
    setLoadState('loading');
    try {
      const offerings = await Purchases.getOfferings();
      const pkgs = offerings.current?.availablePackages ?? [];
      setPackages(pkgs);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { loadOfferings(); }, [loadOfferings]);

  const handleSubscribe = useCallback(async (pkg: PurchasesPackage) => {
    setPurchasing(pkg.identifier);
    try {
      await Purchases.purchasePackage(pkg);
      await refreshPro();
      router.back();
    } catch (e: unknown) {
      const err = e as PurchasesError;
      if (err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        // User dismissed the payment sheet — no alert needed
      } else if (
        err.code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR ||
        err.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR ||
        err.code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR
      ) {
        Alert.alert(
          'Billing Unavailable',
          'There was a problem with the App Store or Google Play. Please check your payment method and try again.',
        );
      } else if (err.code === PURCHASES_ERROR_CODE.NETWORK_ERROR) {
        Alert.alert(
          'Connection Error',
          'Could not reach the store. Check your connection and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => handleSubscribe(pkg) },
          ],
        );
      } else {
        Alert.alert('Purchase Failed', err.message ?? 'An unexpected error occurred.');
      }
    } finally {
      setPurchasing(null);
    }
  }, [refreshPro]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      await Purchases.restorePurchases();
      await refreshPro();
      Alert.alert('Purchases Restored', 'Your Pro subscription has been restored.');
    } catch (e: unknown) {
      const err = e as PurchasesError;
      if (err.code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        Alert.alert('Restore Failed', err.message ?? 'Could not restore purchases.');
      }
    } finally {
      setRestoring(false);
    }
  }, [refreshPro]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Pro Plan</Text>
      <Text style={styles.subtitle}>By purchasing Pro, you are supporting an independent developer. Thank you!</Text>

      {/* Already subscribed banner */}
      {isPro && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerText}>★  You're on Pro Plan</Text>
          <Text style={styles.activeBannerSub}>
            Manage or cancel your subscription in the App Store / Google Play settings.
          </Text>
        </View>
      )}

      {/* Pricing tiers */}
      {loadState === 'loading' && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Loading plans…</Text>
        </View>
      )}

      {loadState === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Couldn't load subscription plans.</Text>
          <Pressable style={styles.retryBtn} onPress={loadOfferings}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {loadState === 'ready' && packages.length === 0 && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>No plans available at this time.</Text>
        </View>
      )}

      {loadState === 'ready' && packages.map(pkg => {
        const highlighted = isHighlighted(pkg);
        const badge = pkgBadge(pkg);
        const monthly = pkgMonthlyEquiv(pkg);
        const inFlight = purchasing === pkg.identifier;

        return (
          <View
            key={pkg.identifier}
            style={[styles.planCard, highlighted && styles.planCardHighlight]}
          >
            <View style={styles.planTop}>
              <View style={styles.planLeft}>
                <View style={styles.planLabelRow}>
                  <Text style={[styles.planLabel, highlighted && styles.planLabelHighlight]}>
                    {pkgLabel(pkg)}
                  </Text>
                  {badge && (
                    <View style={[styles.badge, highlighted && styles.badgeHighlight]}>
                      <Text style={[styles.badgeText, highlighted && styles.badgeTextHighlight]}>
                        {badge}
                      </Text>
                    </View>
                  )}
                </View>
                {monthly && <Text style={styles.monthlyEquiv}>{monthly}</Text>}
              </View>
              <View style={styles.planRight}>
                <Text style={[styles.price, highlighted && styles.priceHighlight]}>
                  {pkg.product.priceString}
                </Text>
                <Text style={styles.period}>{pkg.product.description}</Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.subscribeBtn,
                highlighted && styles.subscribeBtnHighlight,
                (inFlight || !!purchasing) && styles.subscribeBtnDisabled,
              ]}
              onPress={() => handleSubscribe(pkg)}
              disabled={!!purchasing || restoring}
            >
              {inFlight ? (
                <ActivityIndicator color={highlighted ? '#fff' : Colors.primary} />
              ) : (
                <Text style={[styles.subscribeBtnText, highlighted && styles.subscribeBtnTextHighlight]}>
                  {isPro ? 'Current Plan' : `Subscribe — ${pkg.product.priceString}`}
                </Text>
              )}
            </Pressable>
          </View>
        );
      })}

      {/* Restore Purchases — required by App Store guidelines */}
      <Pressable
        style={[styles.restoreBtn, restoring && styles.subscribeBtnDisabled]}
        onPress={handleRestore}
        disabled={restoring || !!purchasing}
      >
        {restoring
          ? <ActivityIndicator color={Colors.textSecondary} size="small" />
          : <Text style={styles.restoreBtnText}>Restore Purchases</Text>
        }
      </Pressable>

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
          Pro subscribers get automatic access when these features launch.
        </Text>
        {FUTURE_FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureSoon}>◦</Text>
            <Text style={styles.featureTextMuted}>{f}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.legalNote}>
        Prices shown in your local currency. Subscriptions auto-renew unless cancelled at least
        24 hours before the end of the current period. Manage or cancel in your App Store or
        Google Play account settings.
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

  activeBanner: {
    backgroundColor: Colors.primary + '18',
    borderWidth: 1, borderColor: Colors.primary + '60',
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  activeBannerText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '700', marginBottom: 4 },
  activeBannerSub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  loadingBox: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.sm },

  errorBox: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  retryBtnText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },

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
  planRight: { alignItems: 'flex-end', maxWidth: '45%' },
  price: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  priceHighlight: { color: Colors.primary },
  period: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, textAlign: 'right' },

  badge: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeHighlight: { backgroundColor: Colors.primary },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  badgeTextHighlight: { color: '#fff' },

  subscribeBtn: {
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary, minHeight: 48, justifyContent: 'center',
  },
  subscribeBtnHighlight: { backgroundColor: Colors.primary },
  subscribeBtnDisabled: { opacity: 0.55 },
  subscribeBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  subscribeBtnTextHighlight: { color: '#fff' },

  restoreBtn: {
    alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.lg,
    minHeight: 44, justifyContent: 'center',
  },
  restoreBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },

  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, marginBottom: Spacing.md, marginTop: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs,
  },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  featureRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, alignItems: 'flex-start' },
  featureCheck: { fontSize: FontSize.md, color: Colors.success, fontWeight: '700', lineHeight: 22 },
  featureSoon: { fontSize: FontSize.lg, color: Colors.textDisabled, lineHeight: 22 },
  featureText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  featureTextMuted: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  legalNote: {
    fontSize: FontSize.xs, color: Colors.textDisabled,
    textAlign: 'center', marginTop: Spacing.sm, lineHeight: 18,
  },
});

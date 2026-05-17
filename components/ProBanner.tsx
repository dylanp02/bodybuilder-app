import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '../lib/ThemeContext';
import { useProContext } from '../lib/ProContext';
import { FontSize, Spacing } from '../constants/theme';
import { type AppColors } from '../constants/theme';

export default function ProBanner() {
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const { isPro } = useProContext();

  if (isPro) {
    return (
      <View style={styles.proBanner}>
        <Text style={styles.proBannerText}>★  Pro Plan</Text>
      </View>
    );
  }

  return (
    <Pressable style={styles.standardBanner} onPress={() => router.push('/subscription')}>
      <Text style={styles.standardBannerText}>Standard Plan  →  Go Pro!</Text>
      <Text style={styles.standardBannerChevron}>›</Text>
    </Pressable>
  );
}

const makeStyles = (Colors: AppColors) => StyleSheet.create({
  proBanner: {
    backgroundColor: Colors.primary + '18',
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '40',
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  proBannerText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  standardBanner: {
    backgroundColor: Colors.warning + '18',
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '40',
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  standardBannerText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.warning,
  },
  standardBannerChevron: {
    fontSize: 18,
    color: Colors.warning,
    fontWeight: '300',
    lineHeight: 20,
  },
});

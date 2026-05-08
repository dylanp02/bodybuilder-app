// app/goals.tsx
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

const SECTIONS = [
  {
    title: 'Body Weight',
    description: 'Log your current weight and view your history',
    route: '/weight-history',
  },
  {
    title: 'Top Sets',
    description: 'Record personal bests from before you started tracking',
    route: '/top-sets',
  },
  {
    title: 'Measurements',
    description: 'Track neck, chest, waist, hips, biceps, and more',
    route: '/measurements',
  },
];

export default function GoalsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Goals</Text>

      {SECTIONS.map(item => (
        <Pressable
          key={item.route}
          style={styles.card}
          onPress={() => router.push(item.route as any)}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>{item.description}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
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
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardLeft: { flex: 1, marginRight: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  chevron: { fontSize: 22, color: Colors.textSecondary, fontWeight: '300' },
});

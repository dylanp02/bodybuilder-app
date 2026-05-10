// app/(tabs)/_layout.tsx — tab bar configuration with custom PNG icons and dynamic theme colors
import { Image, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useColors } from '../../lib/ThemeContext';

const icons = {
  index:    require('../../components/ui/icons/calendar (1).png'),
  workout:  require('../../components/ui/icons/barbell.png'),
  progress: require('../../components/ui/icons/chart.png'),
  planner:  require('../../components/ui/icons/diary.png'),
} as const;

type IconName = keyof typeof icons;

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <Image
      source={icons[name]}
      style={[styles.icon, { tintColor: color }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: { width: 24, height: 24 },
});

export default function TabLayout() {
  const Colors = useColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textDisabled,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <TabIcon name="index" color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color }) => <TabIcon name="workout" color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <TabIcon name="progress" color={color} />,
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: 'Planner',
          tabBarIcon: ({ color }) => <TabIcon name="planner" color={color} />,
        }}
      />
      {/* coach.tsx is kept as a redirect only — not shown in the tab bar */}
      <Tabs.Screen name="coach" options={{ href: null }} />
    </Tabs>
  );
}

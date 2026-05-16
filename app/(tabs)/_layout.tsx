// app/(tabs)/_layout.tsx
import { useCallback, useMemo, useRef } from 'react';
import {
  Animated, Dimensions, Image, PanResponder,
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../lib/ThemeContext';
import { type AppColors, FontSize } from '../../constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// The page slides until the banner is fully exposed, then freezes.
// This width is both the banner's visual width and the freeze point.
const BANNER_WIDTH   = 56;
const TAB_BAR_HEIGHT = 56;

// ─── Tab metadata ─────────────────────────────────────────────────────────────

const TAB_ROUTES = ['index', 'workout', 'progress', 'planner'] as const;
type TabRoute = typeof TAB_ROUTES[number];

const TAB_LABELS: Record<TabRoute, string> = {
  index:    'Today',
  workout:  'Workout',
  progress: 'Progress',
  planner:  'Planner',
};

const TAB_PATHS: Record<TabRoute, string> = {
  index:    '/(tabs)/',
  workout:  '/(tabs)/workout',
  progress: '/(tabs)/progress',
  planner:  '/(tabs)/planner',
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const icons = {
  index:    require('../../components/ui/icons/calendar (1).png'),
  workout:  require('../../components/ui/icons/barbell.png'),
  progress: require('../../components/ui/icons/chart.png'),
  planner:  require('../../components/ui/icons/diary.png'),
} as const;

// ─── Custom tab bar ───────────────────────────────────────────────────────────

function CustomTabBar({
  Colors,
  currentIndex,
  bottomInset,
  onTabPress,
}: {
  Colors: AppColors;
  currentIndex: number;
  bottomInset: number;
  onTabPress: (idx: number) => void;
}) {
  return (
    <View
      style={[
        tabBarStyles.bar,
        {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          height: TAB_BAR_HEIGHT + bottomInset,
          paddingBottom: bottomInset,
        },
      ]}
    >
      {TAB_ROUTES.map((route, idx) => {
        const active = idx === currentIndex;
        const color  = active ? Colors.primary : Colors.textDisabled;
        return (
          <Pressable
            key={route}
            style={tabBarStyles.tab}
            onPress={() => onTabPress(idx)}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Image
              source={icons[route]}
              style={[tabBarStyles.icon, { tintColor: color }]}
              resizeMode="contain"
            />
            <Text style={[tabBarStyles.label, { color }]}>
              {TAB_LABELS[route]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  bar:   { flexDirection: 'row', borderTopWidth: 1 },
  tab:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  icon:  { width: 24, height: 24, marginBottom: 2 },
  label: { fontSize: 11, fontWeight: '500' },
});

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const Colors   = useColors();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const segments = useSegments();

  // 0 at rest; negative = swiped left; positive = swiped right.
  // Clamped to ±BANNER_WIDTH during gesture — the page freezes once the
  // banner is fully exposed.
  const slideX        = useRef(new Animated.Value(0)).current;
  const transitioning = useRef(false);

  // ── Active tab ────────────────────────────────────────────────────────────

  const currentTabIndex = useMemo(() => {
    const seg = (segments as string[])[1];
    if (!seg) return 0;
    const idx = TAB_ROUTES.indexOf(seg as TabRoute);
    return idx === -1 ? 0 : idx;
  }, [segments]);

  const currentIndexRef = useRef(currentTabIndex);
  currentIndexRef.current = currentTabIndex;

  const prevRoute = currentTabIndex > 0
    ? TAB_ROUTES[currentTabIndex - 1] : null;
  const nextRoute = currentTabIndex < TAB_ROUTES.length - 1
    ? TAB_ROUTES[currentTabIndex + 1] : null;

  // ── Scrim (depth cue as page lifts during swipe) ──────────────────────────

  const scrimOpacity = slideX.interpolate({
    inputRange: [-BANNER_WIDTH, 0, BANNER_WIDTH],
    outputRange: [0.18, 0, 0.18],
    extrapolate: 'clamp',
  });

  // ── Transition helpers ────────────────────────────────────────────────────

  const commitTransition = useCallback((direction: 1 | -1) => {
    if (transitioning.current) return;
    transitioning.current = true;

    const targetIdx = currentIndexRef.current + direction;
    if (targetIdx < 0 || targetIdx >= TAB_ROUTES.length) {
      transitioning.current = false;
      return;
    }

    const targetPath  = TAB_PATHS[TAB_ROUTES[targetIdx]];
    // Page is currently frozen at ±BANNER_WIDTH; finish the slide off-screen.
    const exitToValue = -direction * SCREEN_WIDTH;

    Animated.timing(slideX, {
      toValue:        exitToValue,
      duration:       200,
      useNativeDriver: true,
    }).start(() => {
      router.navigate(targetPath as any);
      // Place incoming content on the opposite off-screen side (invisible).
      slideX.setValue(direction * SCREEN_WIDTH);
      // Spring the new page into view.
      Animated.spring(slideX, {
        toValue:         0,
        tension:         72,
        friction:        12,
        useNativeDriver: true,
      }).start(() => { transitioning.current = false; });
    });
  }, [router, slideX]);

  const snapBack = useCallback(() => {
    Animated.spring(slideX, {
      toValue:         0,
      tension:         80,
      friction:        10,
      useNativeDriver: true,
    }).start();
  }, [slideX]);

  // ── Pan responder ─────────────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      // Non-capture variant: child ScrollViews / horizontal lists get first
      // refusal before we intercept.
      onMoveShouldSetPanResponder: (_e, { dx, dy }) =>
        !transitioning.current &&
        Math.abs(dx) > Math.abs(dy) * 1.8 &&
        Math.abs(dx) > 12,

      onPanResponderMove: (_e, { dx }) => {
        if (transitioning.current) return;
        const idx     = currentIndexRef.current;
        const atStart = idx === 0;
        const atEnd   = idx === TAB_ROUTES.length - 1;

        let value = dx;

        if (dx < 0) {
          // Swiping left.
          value = atEnd
            ? dx * 0.07               // rubber-band past last tab
            : Math.max(dx, -BANNER_WIDTH); // freeze when banner is fully exposed
        } else if (dx > 0) {
          // Swiping right.
          value = atStart
            ? dx * 0.07               // rubber-band past first tab
            : Math.min(dx, BANNER_WIDTH);  // freeze when banner is fully exposed
        }

        slideX.setValue(value);
      },

      onPanResponderRelease: (_e, { dx }) => {
        if (transitioning.current) return;
        const idx = currentIndexRef.current;

        // Commit if the finger reached (or passed) full banner exposure.
        if (dx <= -BANNER_WIDTH && idx < TAB_ROUTES.length - 1) {
          commitTransition(1);
        } else if (dx >= BANNER_WIDTH && idx > 0) {
          commitTransition(-1);
        } else {
          snapBack();
        }
      },

      onPanResponderTerminate: () => {
        if (!transitioning.current) snapBack();
      },
    })
  ).current;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const tabBarTotalHeight = TAB_BAR_HEIGHT + insets.bottom;

  const handleTabPress = useCallback((idx: number) => {
    if (idx === currentIndexRef.current || transitioning.current) return;
    router.navigate(TAB_PATHS[TAB_ROUTES[idx]] as any);
  }, [router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }} {...panResponder.panHandlers}>

      {/*
        Banners sit BEHIND the content (rendered first = lower z-order).
        No opacity animation needed — they are physically revealed as the page
        slides away to expose them, then the page freezes when they are fully
        uncovered. pointerEvents="none" so they never intercept touches.
      */}
      {nextRoute && (
        <View pointerEvents="none" style={[styles.banner, styles.bannerRight, { backgroundColor: Colors.primary, bottom: tabBarTotalHeight }]}>
          <Text style={[styles.bannerText, { transform: [{ rotate: '90deg' }] }]}>
            {TAB_LABELS[nextRoute]}
          </Text>
        </View>
      )}

      {prevRoute && (
        <View pointerEvents="none" style={[styles.banner, styles.bannerLeft, { backgroundColor: Colors.primary, bottom: tabBarTotalHeight }]}>
          <Text style={[styles.bannerText, { transform: [{ rotate: '-90deg' }] }]}>
            {TAB_LABELS[prevRoute]}
          </Text>
        </View>
      )}

      {/*
        Animated content wrapper.
        – Translates with the gesture, clamped to ±BANNER_WIDTH.
        – The built-in tab bar is hidden; our fixed CustomTabBar sits outside.
      */}
      <Animated.View style={[styles.contentWrapper, { backgroundColor: Colors.background, transform: [{ translateX: slideX }] }]}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        >
          <Tabs.Screen name="index"    options={{ title: 'Today' }} />
          <Tabs.Screen name="workout"  options={{ title: 'Workout' }} />
          <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
          <Tabs.Screen name="planner"  options={{ title: 'Planner' }} />
        </Tabs>

        {/* Subtle dark scrim — deepens perceived depth as the page slides. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.scrim, { opacity: scrimOpacity }]}
        />
      </Animated.View>

      {/* Fixed tab bar — never translates. */}
      <CustomTabBar
        Colors={Colors}
        currentIndex={currentTabIndex}
        bottomInset={insets.bottom}
        onTabPress={handleTabPress}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  contentWrapper: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },

  banner: {
    position:       'absolute',
    top:            0,
    width:          BANNER_WIDTH,
    justifyContent: 'center',
    alignItems:     'center',
  },
  bannerRight: { right: 0 },
  bannerLeft:  { left:  0 },
  bannerText: {
    color:       '#fff',
    fontSize:    FontSize.sm,
    fontWeight:  '700',
    letterSpacing: 0.8,
    width:       100,      // fixed so rotated text fits within BANNER_WIDTH
    textAlign:   'center',
  },
});

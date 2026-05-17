import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Liftledger',
  slug: 'liftledger',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  scheme: 'bodybuilderapp',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.dylanpalmer.liftledger',
  },
  android: {
    googleServicesFile: './google-services.json',
    package: 'com.dylanpalmer.liftledger',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    '@react-native-firebase/app',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        color: '#7C3AED',
      },
    ],
    '@sentry/react-native/expo',
    'expo-build-properties',
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.SENTRY_DSN,
    revenueCatApiKey: process.env.REVENUECAT_API_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    eas: {
      projectId: '0104b35d-80bc-4fe0-9b21-b3a12c58a26a',
    },
  },
});

import * as fs from 'fs';
import * as path from 'path';
import { ExpoConfig, ConfigContext } from 'expo/config';

const googleServicesBase64 = process.env.GOOGLE_SERVICES_JSON_BASE64;
if (googleServicesBase64) {
  const googleServicesPath = path.join(__dirname, 'google-services.json');
  fs.writeFileSync(googleServicesPath, Buffer.from(googleServicesBase64, 'base64').toString('utf8'));
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Liftledger',
  slug: 'liftledger',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/LiftLedger_corrected.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  scheme: 'bodybuilderapp',
  splash: {
    image: './assets/splash.image.LiftLedger.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0A0A',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.dylanpalmer.liftledger',
  },
  android: {
    googleServicesFile: './google-services.json',
    package: 'com.dylanpalmer.liftledger',
    versionCode: 1,
    icon: './assets/LiftLedger_corrected.png',
    adaptiveIcon: {
      foregroundImage: './assets/LiftLedger_transparent_corrected.png',
      backgroundColor: '#0A0A0A',
    },
    // @ts-ignore — valid Expo manifest field, missing from @expo/config-types
    notification: {
      icon: './assets/LiftLedger_transparent_corrected.png',
      color: '#6C47FF',
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

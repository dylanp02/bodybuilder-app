// constants/theme.ts

export const DarkColors = {
  primary: '#6C47FF',
  primaryLight: '#EDE9FF',
  secondary: '#FF6B35',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceAlt: '#242424',
  border: '#2E2E2E',

  text: '#F5F5F5',
  textSecondary: '#9CA3AF',
  textDisabled: '#4B5563',
};

export const LightColors = {
  primary: '#6C47FF',
  primaryLight: '#EDE9FF',
  secondary: '#FF6B35',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',

  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceAlt: '#E8E8ED',
  border: '#D1D1D6',

  text: '#111111',
  textSecondary: '#6B7280',
  textDisabled: '#AEAEB2',
};

export type AppColors = typeof DarkColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
};

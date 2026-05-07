// constants/theme.ts

export const Colors = {
  primary: '#6C47FF',          // Main purple — buttons, active states
  primaryLight: '#EDE9FF',     // Light purple — backgrounds, tags
  secondary: '#FF6B35',        // Orange — accents, highlights
  success: '#22C55E',          // Green — PRs, positive trends
  warning: '#F59E0B',          // Amber — plateau alerts
  danger: '#EF4444',           // Red — errors, decline trends

  background: '#0F0F0F',       // Near-black app background
  surface: '#1A1A1A',          // Card/component background
  surfaceAlt: '#242424',       // Slightly lighter surface for nested cards
  border: '#2E2E2E',           // Subtle borders

  text: '#F5F5F5',             // Primary text (near-white)
  textSecondary: '#9CA3AF',    // Muted text — labels, timestamps
  textDisabled: '#4B5563',     // Disabled/placeholder text
};

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
  full: 999,   // For pill-shaped elements
};
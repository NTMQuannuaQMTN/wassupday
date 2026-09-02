/**
 * Design tokens for wassupday.
 *
 * The visual direction is "calm, content-first, spacious" — inspired by the
 * feeling of Notion + Apple Calendar simplicity. Colors are mostly neutral;
 * accent colors carry semantic meaning only:
 *
 *   danger  -> urgent / schedule conflict
 *   warning -> needs attention / overdue soon
 *   success -> completed
 *
 * Styling approach: themed primitives (`ThemedText` / `ThemedView`) + React
 * Native `StyleSheet`, driven by these tokens. See PROGRESS.md for why we did
 * not adopt NativeWind in V1.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#37352F',
    textSecondary: '#787774',
    textTertiary: '#9B9A97',
    background: '#FFFFFF',
    backgroundElement: '#F7F7F5',
    backgroundSelected: '#EFEFED',
    border: '#E9E9E7',
    danger: '#E03E3E',
    warning: '#CC7A2B',
    success: '#448361',
    accent: '#2F6FDB',
  },
  dark: {
    text: '#E9E9E7',
    textSecondary: '#9B9B9B',
    textTertiary: '#6F6F6F',
    background: '#191919',
    backgroundElement: '#202020',
    backgroundSelected: '#2C2C2C',
    border: '#2F2F2F',
    danger: '#EB5757',
    warning: '#E0964A',
    success: '#4F9D77',
    accent: '#4C8DF0',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** 4pt spacing scale. Prefer generous whitespace. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;

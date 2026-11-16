import { useWindowDimensions } from 'react-native';

/**
 * SplitEase design tokens — one consistent system for the whole app.
 *
 * Identity: a money ledger, not a recipe/health app. Ledger ink navy
 * (#16233A) is the one disciplined theme color, coin gold (#C98A1B /
 * #E9B44C) is the accent, on warm paper surfaces (#FBF8F0) over a soft
 * cream/amber aurora. Fraunces (bold serif) is the display face —
 * editorial ledger type, deliberately different from FridgeToMeal and
 * MediGuide's Sora. Owed money reads deep green; money owed reads warm
 * terracotta — the two semantic colors of a ledger.
 */

export const palette = {
  // Brand — one disciplined ink navy.
  primary: '#16233A',
  primaryDeep: '#0C1626',
  primaryLight: '#2C4265',
  primarySoft: '#DFE6F0',
  primaryPale: '#EFF2F7',
  // Coin gold accent.
  accent: '#C98A1B',
  accentLight: '#E9B44C',
  accentSoft: '#F7EBCB',
  // Neutrals (ink-tinted so the whole UI feels one family).
  ink: '#141D2B',
  body: '#47536A',
  muted: '#8A94A6',
  line: 'rgba(20, 29, 43, 0.10)',
  surface: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.62)',
  glassStrong: 'rgba(255, 255, 255, 0.80)',
  sheet: 'rgba(255, 255, 255, 0.88)',
  // Aurora background stops — warm paper.
  aurora: ['#F6EEDD', '#FBF8F0', '#EFE6CF'] as const,
  // Ledger semantics.
  owed: '#1E7A4C',
  owedSoft: '#DDF0E4',
  owe: '#C2410C',
  oweSoft: '#FDE9DF',
  // Status.
  warning: '#8A6D1B',
  warningSoft: '#FBF3DC',
  error: '#B3261E',
  errorSoft: '#FCE8E6',
  success: '#1E7A4C',
} as const;

/** Avatar circle colors for group members (cycled by member index). */
export const memberColors = [
  '#16233A',
  '#C98A1B',
  '#1E7A4C',
  '#C2410C',
  '#6D4C9E',
  '#0E7C7B',
  '#B23A48',
  '#3E6B8E',
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 18,
  card: 30,
  sheet: 38,
  pill: 999,
  input: 24,
} as const;

/**
 * Display typeface — Fraunces (bundled via @expo-google-fonts/fraunces,
 * loaded in app/_layout.tsx). Used for headlines, screen titles and big
 * numbers; body text stays on the system font.
 */
export const font = {
  display: 'Fraunces_900Black',
  bold: 'Fraunces_700Bold',
} as const;

export const type = {
  display: { fontFamily: font.display, fontSize: 42, lineHeight: 46, letterSpacing: -0.5 },
  displayWide: { fontFamily: font.display, fontSize: 56, lineHeight: 60, letterSpacing: -0.5 },
  title: { fontFamily: font.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  subtitle: { fontFamily: font.bold, fontSize: 17, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.6 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 1.1 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#0C1626',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  glow: {
    shadowColor: '#16233A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  goldGlow: {
    shadowColor: '#C98A1B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  float: {
    shadowColor: '#141D2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;

export type Breakpoint = 'compact' | 'medium' | 'wide' | 'desktop';

export interface Responsive {
  breakpoint: Breakpoint;
  width: number;
  /** Max width for the centered content column. */
  contentMaxWidth: number;
  /** Horizontal page padding. */
  pad: number;
  /** Columns for card grids. */
  columns: number;
  /** Two-pane list + detail layout (foldable unfolded / tablet / desktop). */
  twoPane: boolean;
  display: typeof type.display | typeof type.displayWide;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  if (width < 600) {
    return {
      breakpoint: 'compact',
      width,
      contentMaxWidth: width,
      pad: 20,
      columns: 1,
      twoPane: false,
      display: type.display,
    };
  }
  if (width < 840) {
    return {
      breakpoint: 'medium',
      width,
      contentMaxWidth: 640,
      pad: 28,
      columns: 1,
      twoPane: false,
      display: type.displayWide,
    };
  }
  if (width < 1280) {
    return {
      breakpoint: 'wide',
      width,
      contentMaxWidth: 1024,
      pad: 32,
      columns: 2,
      twoPane: true,
      display: type.displayWide,
    };
  }
  return {
    breakpoint: 'desktop',
    width,
    contentMaxWidth: 1120,
    pad: 40,
    columns: 3,
    twoPane: true,
    display: type.displayWide,
  };
}

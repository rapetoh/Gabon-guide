export type AppTheme = 'clean' | 'vibrant' | 'dark'

export type ThemeColors = {
  // Page background
  bgPrimary: string

  // Text hierarchy
  textPrimary: string
  textSecondary: string
  textTertiary: string
  textPlaceholder: string

  // Surfaces — translucent cards and sections
  surface: string
  surfaceBorder: string

  // Elevated — opaque surfaces (map overlays, sheet headers, login form)
  surfaceElevated: string
  surfaceElevatedBorder: string

  // Inverted — buttons that are dark in light mode, visible in dark mode
  surfaceInverted: string

  // Form controls
  inputBg: string
  inputBorder: string
  inputText: string

  // Toggle / segmented controls
  toggleBg: string
  toggleActive: string

  // UI primitives
  separator: string       // thin row dividers
  divider: string         // stronger lines (auth page "or")
  iconMuted: string       // chevrons, inactive icons
  shimmer: string         // loading skeleton background
  thumbFallback: string   // image placeholder background
  searchDivider: string   // the 1px line between search text and AI pill
  closeButtonBg: string   // small circular close/dismiss buttons
  sheetHandle: string     // bottom sheet drag handle
}

const CLEAN: ThemeColors = {
  bgPrimary: '#F2F2F7',

  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary: 'rgba(0,0,0,0.3)',
  textPlaceholder: 'rgba(60,60,67,0.6)',

  surface: 'rgba(255,255,255,0.7)',
  surfaceBorder: 'rgba(255,255,255,0.5)',

  surfaceElevated: 'rgba(255,255,255,0.92)',
  surfaceElevatedBorder: 'rgba(255,255,255,0.5)',

  surfaceInverted: '#1C1C1E',

  inputBg: '#F9FAFB',
  inputBorder: '#E5E7EB',
  inputText: '#1F2937',

  toggleBg: '#F3F4F6',
  toggleActive: '#FFFFFF',

  separator: 'rgba(0,0,0,0.04)',
  divider: '#E5E7EB',
  iconMuted: '#C7C7CC',
  shimmer: '#E5E5EA',
  thumbFallback: 'rgba(200,200,210,0.3)',
  searchDivider: 'rgba(0,0,0,0.08)',
  closeButtonBg: 'rgba(0,0,0,0.06)',
  sheetHandle: 'rgba(0,0,0,0.15)',
}

const DARK: ThemeColors = {
  bgPrimary: '#0D0D0F',

  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.55)',
  textTertiary: 'rgba(255,255,255,0.3)',
  textPlaceholder: 'rgba(255,255,255,0.32)',

  surface: 'rgba(255,255,255,0.08)',
  surfaceBorder: 'rgba(255,255,255,0.1)',

  surfaceElevated: '#1C1C1E',
  surfaceElevatedBorder: 'rgba(255,255,255,0.1)',

  surfaceInverted: '#3A3A3C',

  inputBg: '#1C1C1E',
  inputBorder: 'rgba(255,255,255,0.12)',
  inputText: '#FFFFFF',

  toggleBg: '#2C2C2E',
  toggleActive: '#3A3A3C',

  separator: 'rgba(255,255,255,0.07)',
  divider: 'rgba(255,255,255,0.12)',
  iconMuted: '#48484A',
  shimmer: '#2C2C2E',
  thumbFallback: 'rgba(60,60,60,0.5)',
  searchDivider: 'rgba(255,255,255,0.15)',
  closeButtonBg: 'rgba(255,255,255,0.1)',
  sheetHandle: 'rgba(255,255,255,0.2)',
}

// Vibrant shares all color tokens with clean — only the AppBackground gradient differs
export const THEMES: Record<AppTheme, ThemeColors> = {
  clean: CLEAN,
  vibrant: CLEAN,
  dark: DARK,
}

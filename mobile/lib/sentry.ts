// Crash reporting. Fully env-driven: without EXPO_PUBLIC_SENTRY_DSN this is
// a no-op, so dev and older binaries behave identically. The RNSentry native
// module ships with any binary built after @sentry/react-native was added
// (build #10+, via Expo autolinking) — probe the registry first so older
// binaries don't crash on the import (same pattern as usePushRegistration).
//
// Source-map upload (readable stack traces) needs the Sentry expo plugin +
// SENTRY_AUTH_TOKEN — wire that once the Sentry org exists.

export async function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN
  if (!dsn) return

  try {
    const { requireOptionalNativeModule } = await import('expo-modules-core')
    if (!requireOptionalNativeModule('RNSentry')) return

    const Sentry = await import('@sentry/react-native')
    Sentry.init({
      dsn,
      // Errors only for now — no performance tracing, keeps the free plan happy.
      tracesSampleRate: 0,
      enableNativeCrashHandling: true,
    })
  } catch {
    // Never let crash reporting crash the app.
  }
}

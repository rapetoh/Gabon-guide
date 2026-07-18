export default {
  expo: {
    name: "O'Kili",
    slug: 'okili',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.okili.app',
      usesAppleSignIn: true,
      infoPlist: {
        // Declare standard/exempt encryption only — required for App Store compliance
        ITSAppUsesNonExemptEncryption: false,
        // react-native-maps 1.x reads GMSApiKey from Info.plist for Google Maps on iOS.
        // We no longer use ios.config.googleMapsApiKey because that triggers an install
        // of the deprecated react-native-google-maps pod which no longer exists in v1.x.
        GMSApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
    },
    android: {
      package: 'com.okili.app',
      adaptiveIcon: {
        backgroundColor: '#ffffff',
        foregroundImage: './assets/android-icon-foreground.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      config: {
        googleMaps: {
          // Injected from .env at build time — never committed to git
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      // iOS builds FAIL until the provisioning profile gains the Push
      // capability — expo-notifications requests the aps-environment
      // entitlement just by being installed (auto-linked plugin). One-time
      // founder fix: run `cd mobile && npx eas-cli build -p ios --profile
      // production` in a terminal and log into Apple when asked; EAS then
      // regenerates the profile (push key 423ZGLXN46 already assigned).
      'expo-notifications',
      'expo-apple-authentication',
      'expo-video',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'O\'Kili utilise votre position pour trouver les lieux près de vous et, si vous l\'activez, vous signaler les bons plans quand vous passez à proximité.',
          locationWhenInUsePermission:
            'O\'Kili utilise votre position pour trouver les lieux près de vous.',
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'O\'Kili a besoin de la caméra pour scanner les coupons que vos clients vous présentent.',
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      './plugins/withExpoCameraBarcodeScanning',
    ],
    scheme: 'okili',
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: 'bd4c254f-7e0e-4dd1-a4bd-c658c7dd539f',
      },
    },
  },
}

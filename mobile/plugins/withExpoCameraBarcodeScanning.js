// expo-camera 55 split barcode scanning into a separate iOS pod
// (`ExpoCameraBarcodeScanning`) that is NOT picked up by Expo autolinking —
// expo-module.config.json only registers the main ExpoCamera podspec, and
// ExpoCamera.podspec explicitly excludes barcode-scanning sources. Without
// this companion pod, the iOS BarcodeScanner silently bails on every scan
// (BarcodeScanner.swift: `guard barcodeProvider != nil else { return }`)
// because `NSClassFromString("ExpoCameraZXingProvider")` returns nil.
// Camera preview keeps working — only scanning is broken — which makes the
// failure mode look like a JS prop wiring bug. It isn't.
//
// This plugin appends the missing pod to ios/Podfile during prebuild so it
// survives `npx expo prebuild` regenerating the iOS folder.

const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const MARKER = 'ExpoCameraBarcodeScanning'
// ZXingObjC is the Objective-C transitive dep that ExpoCameraBarcodeScanning
// imports from Swift. ZXingObjC ships without a module map, so CocoaPods
// can't integrate it as a static library for Swift consumers unless we ask
// for modular headers explicitly. Declaring the subspecs here mirrors what
// ExpoCameraBarcodeScanning.podspec depends on.
const POD_LINES = [
  "  pod 'ExpoCameraBarcodeScanning', :path => '../node_modules/expo-camera/ios'",
  "  pod 'ZXingObjC/PDF417', :modular_headers => true",
  "  pod 'ZXingObjC/OneD', :modular_headers => true",
].join('\n')

module.exports = function withExpoCameraBarcodeScanning(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile')
      let contents = fs.readFileSync(podfilePath, 'utf8')

      if (contents.includes(MARKER)) return cfg

      // Insert just after `use_expo_modules!` so it's part of the same target block.
      const replaced = contents.replace(
        /(use_expo_modules!\s*\n)/,
        `$1${POD_LINES}\n`,
      )

      if (replaced === contents) {
        throw new Error(
          'withExpoCameraBarcodeScanning: could not find `use_expo_modules!` in Podfile to anchor injection',
        )
      }

      fs.writeFileSync(podfilePath, replaced, 'utf8')
      return cfg
    },
  ])
}

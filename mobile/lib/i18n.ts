import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '../locales/en.json'
import fr from '../locales/fr.json'

const LANGUAGE_STORAGE_KEY = 'okili.language'

// Detect device language — default to French (Gabon's official language)
const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'fr'
const supportedLanguage = ['fr', 'en'].includes(deviceLanguage) ? deviceLanguage : 'fr'

// Init synchronously with the device language so the app renders immediately…
i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: supportedLanguage,
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false, // React already handles escaping
  },
})

// …then apply the user's persisted choice (if any) as soon as storage answers.
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then(stored => {
    if (stored && ['fr', 'en'].includes(stored) && stored !== i18n.language) {
      i18n.changeLanguage(stored)
    }
  })
  .catch(() => {}) // storage unavailable → keep device detection

// Persist every language change so it survives app restarts.
i18n.on('languageChanged', lng => {
  AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng).catch(() => {})
})

export default i18n

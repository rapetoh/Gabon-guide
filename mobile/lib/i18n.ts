import * as Localization from 'expo-localization'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '../locales/en.json'
import fr from '../locales/fr.json'

// Detect device language — default to French (Gabon's official language)
const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'fr'
const supportedLanguage = ['fr', 'en'].includes(deviceLanguage) ? deviceLanguage : 'fr'

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

export default i18n

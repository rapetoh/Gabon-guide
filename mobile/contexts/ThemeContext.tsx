import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState } from 'react'
import { THEMES, ThemeColors, AppTheme } from '../constants/themes'

export type { AppTheme, ThemeColors }

interface ThemeContextValue {
  theme: AppTheme
  setTheme: (t: AppTheme) => void
  colors: ThemeColors
}

const STORAGE_KEY = 'okili-theme'

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'clean',
  setTheme: () => {},
  colors: THEMES.clean,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('clean')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'clean' || saved === 'vibrant' || saved === 'dark') setThemeState(saved)
    })
  }, [])

  function setTheme(t: AppTheme) {
    setThemeState(t)
    AsyncStorage.setItem(STORAGE_KEY, t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors: THEMES[theme] }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors
}

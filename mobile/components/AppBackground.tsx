import { LinearGradient } from 'expo-linear-gradient'
import { Dimensions, StyleSheet, View } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'

const { width } = Dimensions.get('window')

export default function AppBackground({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()

  if (theme === 'vibrant') {
    return (
      <LinearGradient
        colors={['#ffdee9', '#b5fffc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        {children}
      </LinearGradient>
    )
  }

  if (theme === 'dark') {
    return (
      <LinearGradient
        colors={['#0D0D0F', '#111113']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.fill}
      >
        {/* Very subtle warm blob — barely perceptible, adds depth */}
        <View style={styles.darkBlobTL} />
        <View style={styles.darkBlobBR} />
        {children}
      </LinearGradient>
    )
  }

  // Clean (default)
  return (
    <View style={[styles.fill, styles.cleanBg]}>
      <View style={styles.blobTL} />
      <View style={styles.blobTR} />
      <View style={styles.blobBR} />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cleanBg: { backgroundColor: '#F2F2F7' },

  // Clean mode blobs
  blobTL: {
    position: 'absolute', top: 0, left: 0,
    width: width * 0.7, height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(0,122,255,0.08)',
    transform: [{ translateX: -width * 0.2 }, { translateY: -width * 0.2 }],
  },
  blobTR: {
    position: 'absolute', top: 0, right: 0,
    width: width * 0.6, height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: 'rgba(255,149,0,0.07)',
    transform: [{ translateX: width * 0.2 }, { translateY: -width * 0.2 }],
  },
  blobBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: width * 0.7, height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(52,199,89,0.07)',
    transform: [{ translateX: width * 0.2 }, { translateY: width * 0.2 }],
  },

  // Dark mode blobs — barely perceptible, just adds depth
  darkBlobTL: {
    position: 'absolute', top: 0, left: 0,
    width: width * 0.8, height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(232,87,26,0.05)',
    transform: [{ translateX: -width * 0.3 }, { translateY: -width * 0.3 }],
  },
  darkBlobBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: width * 0.7, height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(0,122,255,0.04)',
    transform: [{ translateX: width * 0.2 }, { translateY: width * 0.2 }],
  },
})

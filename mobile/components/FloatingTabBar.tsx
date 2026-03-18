import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index:     { active: 'home',       inactive: 'home-outline' },
  explore:   { active: 'search',     inactive: 'search-outline' },
  map:       { active: 'map',        inactive: 'map-outline' },
  favorites: { active: 'heart',      inactive: 'heart-outline' },
  profile:   { active: 'person',     inactive: 'person-outline' },
}

const ACTIVE_COLOR   = '#FFFFFF'
const INACTIVE_COLOR = 'rgba(255,255,255,0.45)'

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
      <BlurView intensity={80} tint="dark" style={styles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
          const icons = ICONS[route.name] ?? ICONS['index']
          const iconName = isFocused ? icons.active : icons.inactive

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              hitSlop={8}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Ionicons
                  name={iconName}
                  size={24}
                  color={isFocused ? ACTIVE_COLOR : INACTIVE_COLOR}
                />
              </View>
            </Pressable>
          )
        })}
      </BlurView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    width: '100%',
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
})

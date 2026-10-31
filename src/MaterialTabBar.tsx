import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BottomNavigation } from 'react-native-paper';

/** Material 3 navigation bar (pill indicator, Paper theme) for the JS tabs, whose own bar is the iPhone one. */
export function MaterialTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const title = ({ route }: { route: { key: string } }) => descriptors[route.key].options.title;
  return (
    <BottomNavigation.Bar
      navigationState={state}
      onTabPress={({ route, preventDefault }) => {
        const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (event.defaultPrevented) preventDefault();
        else if (route.key !== state.routes[state.index].key) navigateToTab(route.key);
      }}
      renderIcon={({ route, focused, color }) => descriptors[route.key].options.tabBarIcon?.({ focused, color, size: 24 })}
      getLabelText={title}
      // Paper draws each label twice (active and inactive) and a screen reader would read both.
      getAccessibilityLabel={title}
    />
  );
}

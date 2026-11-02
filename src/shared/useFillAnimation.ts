import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/** A gauge's fill, from 0 to 1: it slides to its value (from empty when the screen opens), unless the phone asks for no motion. */
export function useFillAnimation(progress: number): Animated.Value {
  const [fill] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);
  useEffect(() => {
    Animated.timing(fill, { toValue: Math.max(0, Math.min(progress, 1)), duration: reduceMotion ? 0 : 450, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [fill, progress, reduceMotion]);
  return fill;
}

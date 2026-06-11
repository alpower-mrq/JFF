import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { SYMBOLS, SymbolKey } from './symbols';

const USE_NATIVE = Platform.OS !== 'web';

// Shake keyframe durations (ms) — kept here so the cleanup timer can sum them.
const SCALE_IN = 420;
const SHAKE = [70, 110, 110, 110, 70];
const VANISH = 320;
const TOTAL = SCALE_IN + SHAKE.reduce((a, b) => a + b, 0) + VANISH + 60;

/**
 * The 3-in-a-row payoff: the winning symbol scales out from the middle of the
 * reel window, shakes, then scales up and fades away. Re-fires on `trigger`.
 * Rendered as a full-screen overlay; positioned via centerX / centerY (the
 * reel-window centre, in window coordinates).
 */
export default function JackpotSymbol({
  trigger,
  symbol,
  size,
  centerX,
  centerY,
}: {
  trigger: number;
  symbol: SymbolKey | null;
  size: number;
  centerX: number;
  centerY: number;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<SymbolKey | null>(null);

  useEffect(() => {
    if (trigger === 0 || !symbol) return;
    setShown(symbol);
    scale.setValue(0);
    shake.setValue(0);
    opacity.setValue(1);

    const wiggle = (to: number, d: number) =>
      Animated.timing(shake, { toValue: to, duration: d, easing: Easing.linear, useNativeDriver: USE_NATIVE });

    Animated.sequence([
      // scale out from the middle, overshooting
      Animated.timing(scale, { toValue: 1, duration: SCALE_IN, easing: Easing.out(Easing.back(2.4)), useNativeDriver: USE_NATIVE }),
      // shake
      Animated.sequence([
        wiggle(1, SHAKE[0]),
        wiggle(-1, SHAKE[1]),
        wiggle(1, SHAKE[2]),
        wiggle(-1, SHAKE[3]),
        wiggle(0, SHAKE[4]),
      ]),
      // disappear: blow up + fade
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.7, duration: VANISH, easing: Easing.in(Easing.cubic), useNativeDriver: USE_NATIVE }),
        Animated.timing(opacity, { toValue: 0, duration: VANISH, easing: Easing.in(Easing.cubic), useNativeDriver: USE_NATIVE }),
      ]),
    ]).start();

    // Animated's .start() callback is unreliable on react-native-web, so unmount
    // on a timer once the sequence has finished.
    const id = setTimeout(() => setShown(null), TOTAL);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!shown) return null;
  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-13deg', '13deg'] });

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      <Animated.Image
        source={SYMBOLS[shown]}
        resizeMode="contain"
        style={{
          position: 'absolute',
          left: centerX - size / 2,
          top: centerY - size / 2,
          width: size,
          height: size,
          opacity,
          transform: [{ scale }, { rotate }],
        }}
      />
    </View>
  );
}

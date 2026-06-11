import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SYMBOLS } from './symbols';

const MAX = 50; // pool size — the most coins we ever splash at once (a jackpot)
const USE_NATIVE = Platform.OS !== 'web';

type CoinParam = {
  dx: number;
  rise: number;
  fall: number;
  spin: number;
  size: number;
  dur: number;
  delay: number;
};

/**
 * A burst of coins that erupts upward from `originY` (screen Y), arcs out, then
 * falls and fades. Re-fires whenever `trigger` changes.
 */
export default function CoinCelebration({
  trigger,
  originY,
  count = 10,
}: {
  trigger: number;
  originY: number;
  count?: number;
}) {
  const { width, height } = useWindowDimensions();
  const vals = useRef(
    Array.from({ length: MAX }, () => new Animated.Value(0))
  ).current;
  const [params, setParams] = useState<CoinParam[]>([]);
  useEffect(() => {
    if (trigger === 0) return;
    // Splash exactly `count` coins (10 / 30 / 50 for single / pair / triple).
    const n = Math.max(1, Math.min(count, MAX));
    const p: CoinParam[] = Array.from({ length: n }, () => ({
      dx: (Math.random() * 2 - 1) * width * 0.5,
      rise: height * (0.2 + Math.random() * 0.22),
      fall: height * (0.55 + Math.random() * 0.45),
      spin: (Math.random() * 2 - 1) * 720,
      size: 28 + Math.random() * 22,
      dur: 1500 + Math.random() * 800,
      delay: Math.random() * 220,
    }));
    setParams(p);
    Animated.parallel(
      p.map((_, i) => {
        vals[i].setValue(0);
        return Animated.timing(vals[i], {
          toValue: 1,
          duration: p[i].dur,
          delay: p[i].delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE,
        });
      })
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (params.length === 0) return null;
  // Fallback if measureInWindow hasn't produced a value yet (web-safe).
  const oy = originY > 0 ? originY : height * 0.34;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {params.map((p, i) => {
        const v = vals[i];
        const translateX = v.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.dx],
        });
        const translateY = v.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, -p.rise, p.fall],
        });
        const rotate = v.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.spin}deg`],
        });
        const opacity = v.interpolate({
          inputRange: [0, 0.8, 1],
          outputRange: [1, 1, 0],
        });
        const scale = v.interpolate({
          inputRange: [0, 0.15, 1],
          outputRange: [0.4, 1.1, 0.85],
        });
        return (
          <Animated.Image
            key={i}
            source={SYMBOLS.coin}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: width / 2 - p.size / 2,
              top: oy - p.size / 2,
              width: p.size,
              height: p.size,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

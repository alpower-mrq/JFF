import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SYMBOLS } from './symbols';

const MAX = 18;
const USE_NATIVE = Platform.OS !== 'web';

// Reel area fractions — must match SlotMachine.tsx
const REEL_AREA = { x: 0.105, y: 0.41, w: 0.79 };

// TopBar coin icon center on screen
const TARGET_X = 16 + 29; // left: 16, coin width: 58 → center at 45
const TARGET_Y = 16 + 29;

type CoinParam = {
  startX: number;
  startY: number;
  burstDx: number;
  burstDy: number;
  size: number;
  dur: number;
  delay: number;
};

export default function CoinCelebration({
  trigger,
  originY,
  shellW,
  width,
  count = 10,
}: {
  trigger: number;
  originY: number;
  shellW: number;
  width: number;
  count?: number;
}) {
  const vals = useRef(
    Array.from({ length: MAX }, () => new Animated.Value(0))
  ).current;
  const [params, setParams] = useState<CoinParam[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const n = Math.max(1, Math.min(count, MAX));

    // Compute the 3 reel center X positions on screen
    const shellLeft = (width - shellW) / 2;
    const reelAreaLeft = shellLeft + REEL_AREA.x * shellW;
    const reelW = (REEL_AREA.w * shellW) / 3;
    const reelCenters = [0, 1, 2].map(i => reelAreaLeft + reelW * (i + 0.5));

    const oy = originY > 0 ? originY : 300;

    const p: CoinParam[] = Array.from({ length: n }, (_, i) => {
      const reel = i % 3;
      const sx = reelCenters[reel];
      return {
        startX: sx,
        startY: oy,
        burstDx: (Math.random() - 0.5) * reelW * 0.6,
        burstDy: -(20 + Math.random() * 40),
        size: 24 + Math.random() * 14,
        dur: 700 + Math.random() * 300,
        delay: Math.floor(i / 3) * 80 + Math.random() * 40,
      };
    });

    setParams(p);
    vals.slice(0, n).forEach((v, i) => {
      v.setValue(0);
      Animated.timing(v, {
        toValue: 1,
        duration: p[i].dur,
        delay: p[i].delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE,
      }).start();
    });
  }, [trigger]);

  if (params.length === 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {params.map((p, i) => {
        const v = vals[i];
        // Phase 1 (0→0.2): burst outward from reel
        // Phase 2 (0.2→1): zoom toward coin counter, shrinking
        const translateX = v.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [p.startX, p.startX + p.burstDx, TARGET_X],
        });
        const translateY = v.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [p.startY, p.startY + p.burstDy, TARGET_Y],
        });
        const scale = v.interpolate({
          inputRange: [0, 0.15, 0.85, 1],
          outputRange: [0.2, 1.1, 0.5, 0.15],
        });
        const opacity = v.interpolate({
          inputRange: [0, 0.08, 0.88, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.Image
            key={i}
            source={SYMBOLS.coin}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: -p.size / 2,
              top: -p.size / 2,
              width: p.size,
              height: p.size,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

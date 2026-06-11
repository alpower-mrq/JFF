import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, View, useWindowDimensions } from 'react-native';
import { SYMBOLS } from './symbols';

const USE_NATIVE = Platform.OS !== 'web';
const DURATION = 2400; // total shower time (≈ the MrQ.wav intro length)

type Coin = {
  x: number;
  startY: number;
  targetY: number;
  endY: number;
  dropStart: number;
  dropEnd: number;
  fallStart: number;
  fallEnd: number;
  size: number;
  spin: number;
};

/**
 * Page-load welcome: a dense, screen-filling shower of coins drops in, briefly
 * covers everything, then falls away — revealing the machine (which fades in
 * underneath) as the coins clear. Mounts once and unmounts itself when done.
 * While mounted it covers the screen, so it also blocks taps during the intro.
 */
export default function IntroCoinShower({ onDone }: { onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  // A jittered, brick-offset grid so the coins blanket the screen at the peak.
  const coins = useMemo<Coin[]>(() => {
    const cols = Math.max(6, Math.min(10, Math.round(width / 70)));
    const spacing = width / cols;
    const base = spacing * 1.7; // big overlap so the coins fully blanket the screen
    const rows = Math.max(8, Math.min(18, Math.ceil(height / spacing) + 3));
    const out: Coin[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const brick = (r % 2) * (spacing / 2);
        const x = c * spacing + brick - spacing / 2 + (Math.random() * 2 - 1) * spacing * 0.25;
        const targetY = r * spacing - spacing / 2 + (Math.random() * 2 - 1) * spacing * 0.25;
        const dropStart = Math.random() * 0.12;
        const fallStart = 0.44 + Math.random() * 0.16;
        out.push({
          x,
          startY: -(base + 40 + Math.random() * height * 0.7), // staggered above the top
          targetY,
          endY: height + base + 40, // off the bottom
          dropStart,
          dropEnd: dropStart + 0.22,
          fallStart,
          fallEnd: Math.min(fallStart + 0.34, 1),
          size: base * (0.85 + Math.random() * 0.45),
          spin: (Math.random() * 2 - 1) * 540,
        });
      }
    }
    return out;
  }, [width, height]);

  useEffect(() => {
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.linear,
      useNativeDriver: USE_NATIVE,
    }).start();
    const id = setTimeout(() => {
      setDone(true);
      onDone && onDone();
    }, DURATION + 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {coins.map((co, i) => {
        const translateY = t.interpolate({
          inputRange: [0, co.dropStart, co.dropEnd, co.fallStart, co.fallEnd, 1],
          outputRange: [co.startY, co.startY, co.targetY, co.targetY, co.endY, co.endY],
        });
        const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${co.spin}deg`] });
        const scale = t.interpolate({
          inputRange: [0, co.dropStart, co.dropEnd, 1],
          outputRange: [0.7, 0.7, 1, 1],
        });
        return (
          <Animated.Image
            key={i}
            source={SYMBOLS.coin}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: co.x,
              top: 0,
              width: co.size,
              height: co.size,
              transform: [{ translateY }, { rotate }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

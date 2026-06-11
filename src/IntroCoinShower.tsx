import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, View, useWindowDimensions } from 'react-native';
import { SYMBOLS } from './symbols';

const USE_NATIVE = Platform.OS !== 'web';
const DURATION = 2400;

type Coin = {
  x: number;
  y0: number;     // Y when coin starts moving (can be on-screen for wave 0)
  y1: number;     // Y when coin exits (below screen)
  tStart: number; // progress [0,1] when coin begins falling
  tEnd: number;   // progress [0,1] when coin reaches y1
  size: number;
  spin: number;
};

/**
 * Page-load welcome: coins rain straight down through the screen — no pause —
 * then the machine fades in underneath. Mounts once and self-unmounts.
 */
export default function IntroCoinShower({ onDone }: { onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);

  const coins = useMemo<Coin[]>(() => {
    const cols = Math.max(7, Math.min(12, Math.round(width / 58)));
    const spacing = width / cols;
    const baseSize = spacing * 1.45;
    const out: Coin[] = [];
    const jitter = () => (Math.random() * 2 - 1) * spacing * 0.22;

    const add = (x: number, y0: number, tStart: number, fallLen: number) => {
      const tEnd = Math.min(tStart + Math.max(fallLen, 0.02), 0.998);
      out.push({
        x,
        y0,
        y1: height + baseSize + 20,
        tStart,
        tEnd,
        size: baseSize * (0.8 + Math.random() * 0.42),
        spin: (Math.random() * 2 - 1) * 540,
      });
    };

    // Wave 0: pre-positioned across the full screen so the shower is dense from t=0.
    // Two interleaved passes (offset by spacing/2) to double coin count.
    for (let pass = 0; pass < 2; pass++) {
      for (let c = 0; c < cols; c++) {
        const brick = (c % 2) * (spacing / 2);
        const x = c * spacing - spacing / 2 + brick + pass * (spacing / 2) + jitter();
        const y0 = -baseSize * 0.3 + Math.random() * (height * 0.82);
        add(x, y0, 0, 0.26 + Math.random() * 0.14);
      }
    }

    // Waves 1–3: fall in from above the screen, staggered. Two passes each.
    const WAVES = 3;
    for (let w = 1; w <= WAVES; w++) {
      for (let pass = 0; pass < 2; pass++) {
        for (let c = 0; c < cols; c++) {
          const brick = (w % 2) * (spacing / 2);
          const x = c * spacing - spacing / 2 + brick + pass * (spacing / 2) + jitter();
          const tStart = (w / (WAVES + 1)) * 0.72 + Math.random() * 0.11;
          const y0 = -(baseSize + Math.random() * 60);
          add(x, y0, tStart, 0.28 + Math.random() * 0.16);
        }
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
      onDone?.();
    }, DURATION + 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {coins.map((co, i) => {
        const translateY = t.interpolate({
          inputRange: [co.tStart, co.tEnd],
          outputRange: [co.y0, co.y1],
          extrapolate: 'clamp',
        });
        const rotate = t.interpolate({
          inputRange: [co.tStart, co.tEnd],
          outputRange: ['0deg', `${co.spin}deg`],
          extrapolate: 'clamp',
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
              transform: [{ translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

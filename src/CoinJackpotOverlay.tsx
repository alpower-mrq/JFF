import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { QOIN_SVG } from './qoin';

const USE_NATIVE = Platform.OS !== 'web';

const RA_X = 0.105;
const RA_W = 0.79;

const FADE_IN  = 300;
const HOLD     = 1000;
const FADE_OUT = 400;
const TOTAL    = FADE_IN + HOLD + FADE_OUT + 80;

export default function CoinJackpotOverlay({
  trigger,
  shellW,
  width,
  originY,
}: {
  trigger: number;
  shellW: number;
  width: number;
  originY: number;
}) {
  const [shown, setShown] = useState(false);
  const opacity   = useRef(new Animated.Value(0)).current;
  const barScaleX = useRef(new Animated.Value(0.3)).current;
  const coinScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (trigger === 0) return;
    setShown(true);
    opacity.setValue(0);
    barScaleX.setValue(0.3);
    coinScale.setValue(0.5);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity,   { toValue: 1,    duration: FADE_IN, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE }),
        Animated.spring(barScaleX, { toValue: 1,    tension: 220, friction: 8, useNativeDriver: USE_NATIVE }),
        Animated.spring(coinScale, { toValue: 1.35, tension: 100, friction: 6, useNativeDriver: USE_NATIVE }),
      ]),
      Animated.delay(HOLD),
      Animated.parallel([
        Animated.timing(opacity,   { toValue: 0,   duration: FADE_OUT, easing: Easing.in(Easing.cubic), useNativeDriver: USE_NATIVE }),
        Animated.timing(coinScale, { toValue: 2.2, duration: FADE_OUT, easing: Easing.in(Easing.cubic), useNativeDriver: USE_NATIVE }),
      ]),
    ]).start();

    const id = setTimeout(() => setShown(false), TOTAL);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!shown) return null;

  const reelW     = (RA_W * shellW) / 3;
  const shellLeft = (width - shellW) / 2;
  const barLeft   = shellLeft + RA_X * shellW;
  const barWidth  = RA_W * shellW;
  const barH      = 58;
  const coinSize  = reelW * 0.72;
  const coinCenters = [0, 1, 2].map(i => shellLeft + RA_X * shellW + reelW * (i + 0.5));

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      {/* Bar */}
      <Animated.View style={{
        position: 'absolute',
        left: barLeft,
        top: originY - barH / 2,
        width: barWidth,
        height: barH,
        borderRadius: 10,
        backgroundColor: 'rgba(251,203,0,0.28)',
        borderWidth: 2,
        borderColor: '#fbcb00',
        opacity,
        transform: [{ scaleX: barScaleX }],
      }} />

      {/* Inner bright stripe */}
      <Animated.View style={{
        position: 'absolute',
        left: barLeft + 4,
        top: originY - 5,
        width: barWidth - 8,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#ffe066',
        opacity,
        transform: [{ scaleX: barScaleX }],
      }} />

      {/* 3 scaled-up coin icons */}
      {coinCenters.map((cx, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: cx - coinSize / 2,
            top: originY - coinSize / 2,
            width: coinSize,
            height: coinSize,
            opacity,
            transform: [{ scale: coinScale }],
          }}
        >
          <SvgXml xml={QOIN_SVG} width={coinSize} height={coinSize} />
        </Animated.View>
      ))}
    </View>
  );
}

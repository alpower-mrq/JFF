import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

const USE_NATIVE = Platform.OS !== 'web';

// Paths shifted so pole starts at x=0, y=0 (original x offset: 176)
const POLE_SVG = `<svg viewBox="0 0 9 60" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4.643 0C2.433 0 0.642 1.870 0.642 4.177V55.279C0.642 57.585 2.433 59.455 4.643 59.455C6.854 59.455 8.645 57.585 8.645 55.279V4.177C8.645 1.870 6.854 0 4.643 0Z" fill="#FBFBFB"/>
</svg>`;

// Paths shifted so flag body starts at x=0 (original x offset: 184, y offset: 0)
const FLAG_SVG = `<svg viewBox="0 -2 56 44" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M52.119 4.556C50.731 3.855 49.07 4.007 47.829 4.947C43.039 8.578 38.404 7.098 31.24 4.383C24.219 1.722 15.481 -1.589 6.857 4.947C5.826 5.729 5.219 6.955 5.219 8.258V32.904C5.219 34.471 6.096 35.904 7.484 36.605C8.872 37.306 10.533 37.154 11.774 36.214C16.564 32.583 21.198 34.063 28.362 36.778C32.359 38.293 36.911 40.018 41.683 40.018C45.294 40.018 49.03 39.030 52.746 36.214C53.777 35.432 54.384 34.206 54.384 32.904V8.258C54.384 6.690 53.507 5.257 52.119 4.556Z" fill="#0F43F4"/>
<path d="M42.138 26.796C40.724 26.796 39.417 26.393 38.308 25.729C39.364 24.067 39.99 22.090 39.99 19.992C39.99 14.010 35.014 9.147 28.893 9.147C22.771 9.147 17.796 14.010 17.796 19.992C17.796 25.974 22.771 30.836 28.893 30.836C31.345 30.836 33.618 30.049 35.444 28.737C37.323 30.066 39.632 30.871 42.138 30.871C43.641 30.871 45.073 30.591 46.38 30.066V25.449C45.199 26.306 43.731 26.796 42.138 26.796ZM35.175 22.021C34.352 21.163 33.385 20.411 32.276 19.817C31.184 19.239 30.038 18.855 28.893 18.645V22.808C29.376 22.948 29.841 23.140 30.289 23.367C31.238 23.875 32.025 24.557 32.634 25.344C31.578 26.061 30.289 26.481 28.911 26.481C25.259 26.498 22.288 23.612 22.288 20.044C22.288 16.476 25.242 13.590 28.893 13.590C32.544 13.590 35.497 16.476 35.497 20.044C35.497 20.744 35.39 21.408 35.175 22.021Z" fill="white"/>
</svg>`;

export default function WavingFlag({ shellW }: { shellW: number }) {
  const wave = useRef(new Animated.Value(0)).current;
  const svgScale = shellW / 356;

  const poleW = 9  * svgScale;
  const poleH = 60 * svgScale;
  const flagW = 56 * svgScale;
  const flagH = 44 * svgScale;
  const poleLeft = 176 * svgScale;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(wave, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [wave]);

  const rotateY = wave.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '38deg'],
  });

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: poleLeft, top: 0, width: poleW + flagW, height: poleH }}
    >
      {/* Static pole */}
      <SvgXml xml={POLE_SVG} width={poleW} height={poleH} style={{ position: 'absolute', left: 0, top: 0 }} />

      {/* Animated flag body — rotateY pivoted at left edge (where it meets the pole) */}
      <Animated.View style={{
        position: 'absolute',
        left: poleW,
        top: 0,
        width: flagW,
        height: flagH,
        transform: [
          { perspective: 500 },
          { translateX: -(flagW / 2) },
          { rotateY },
          { translateX: flagW / 2 },
        ],
      }}>
        <SvgXml xml={FLAG_SVG} width={flagW} height={flagH} />
      </Animated.View>
    </View>
  );
}
